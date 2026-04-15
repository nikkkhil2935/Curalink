import axios from 'axios';
import { parseStringPromise } from 'xml2js';

const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const EMAIL = process.env.PUBMED_EMAIL || 'curalink@demo.com';
const BATCH_SIZE = 50;

async function searchPubMed(query, maxResults = 200, sort = 'pub date') {
  const url = `${BASE_URL}/esearch.fcgi`;
  const params = {
    db: 'pubmed',
    term: query,
    retmax: maxResults,
    sort,
    retmode: 'json',
    email: EMAIL
  };

  try {
    const { data } = await axios.get(url, { params, timeout: 15000 });
    return data?.esearchresult?.idlist || [];
  } catch (err) {
    console.error('PubMed search error:', err.message);
    return [];
  }
}

async function fetchPubMedDetails(ids) {
  if (!ids.length) {
    return [];
  }

  const results = [];

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);

    try {
      const url = `${BASE_URL}/efetch.fcgi`;
      const params = {
        db: 'pubmed',
        id: batch.join(','),
        retmode: 'xml',
        email: EMAIL
      };

      const { data: xml } = await axios.get(url, { params, timeout: 20000 });
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const articles = parsed?.PubmedArticleSet?.PubmedArticle;

      if (!articles) {
        continue;
      }

      const articleArray = Array.isArray(articles) ? articles : [articles];

      for (const article of articleArray) {
        const medline = article?.MedlineCitation;
        if (!medline) {
          continue;
        }

        const articleData = medline.Article;
        const pmid = medline?.PMID?._ || medline?.PMID;
        if (!pmid) {
          continue;
        }

        const title = articleData?.ArticleTitle?._ || articleData?.ArticleTitle || '';
        if (!title) {
          continue;
        }

        let abstract = '';
        const abstractData = articleData?.Abstract?.AbstractText;
        if (typeof abstractData === 'string') {
          abstract = abstractData;
        } else if (Array.isArray(abstractData)) {
          abstract = abstractData.map((item) => item?._ || item || '').join(' ');
        } else if (abstractData?._) {
          abstract = abstractData._;
        }

        const authorList = articleData?.AuthorList?.Author;
        const authors = [];
        if (authorList) {
          const authorArray = Array.isArray(authorList) ? authorList : [authorList];
          for (const author of authorArray.slice(0, 5)) {
            const lastName = author?.LastName || '';
            const foreName = author?.ForeName || author?.Initials || '';
            const collectiveName = author?.CollectiveName || '';
            const displayName = collectiveName || `${lastName} ${foreName}`.trim();
            if (displayName) {
              authors.push(displayName);
            }
          }
        }

        const pubDate = articleData?.Journal?.JournalIssue?.PubDate;
        const year = Number.parseInt(pubDate?.Year || pubDate?.MedlineDate?.substring(0, 4) || '0', 10) || null;
        const journal = articleData?.Journal?.Title || '';

        results.push({
          id: `pubmed:${pmid}`,
          type: 'publication',
          source: 'PubMed',
          title: String(title).replace(/<[^>]*>/g, ''),
          abstract: String(abstract).substring(0, 600),
          authors,
          year,
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          journal
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 350));
    } catch (err) {
      console.error(`PubMed batch ${i} error:`, err.message);
    }
  }

  return results;
}

export async function fetchFromPubMed(query, maxResults = 200, sort = 'pub date') {
  if (!query?.trim()) {
    return [];
  }

  const startTime = Date.now();
  console.log(`PubMed searching: "${query}"`);

  const ids = await searchPubMed(query, maxResults, sort);
  const articles = await fetchPubMedDetails(ids);

  console.log(`PubMed fetched ${articles.length} articles in ${Date.now() - startTime}ms`);
  return articles;
}
