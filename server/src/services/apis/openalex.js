import axios from 'axios';
import logger from '../../../lib/logger.js';

const BASE_URL = 'https://api.openalex.org/works';
const POLITE_EMAIL = process.env.PUBMED_EMAIL || 'curalink@demo.com';

export async function fetchFromOpenAlex(query, targetCount = 200) {
  if (!query?.trim()) {
    return [];
  }

  const startTime = Date.now();
  logger.info(`OpenAlex searching: "${query}"`);

  const results = [];
  const seenIds = new Set();
  const perPage = 100;
  const pagesToFetch = Math.max(1, Math.ceil(targetCount / perPage));

  const fetchConfigs = [
    { sort: 'relevance_score:desc', pages: Math.min(pagesToFetch, 2) },
    { sort: 'publication_date:desc', pages: 1 }
  ];

  for (const config of fetchConfigs) {
    for (let page = 1; page <= config.pages; page += 1) {
      try {
        const params = {
          search: query,
          'per-page': perPage,
          page,
          sort: config.sort,
          filter: 'from_publication_date:2015-01-01',
          mailto: POLITE_EMAIL,
          select:
            'id,title,abstract_inverted_index,authorships,publication_year,doi,primary_location,cited_by_count,open_access'
        };

        const { data } = await axios.get(BASE_URL, { params, timeout: 15000 });

        for (const work of data?.results || []) {
          if (!work?.id || !work?.title) {
            continue;
          }

          const workId = `openalex:${work.id.replace('https://openalex.org/', '')}`;
          if (seenIds.has(workId)) {
            continue;
          }
          seenIds.add(workId);

          const abstract = reconstructAbstract(work.abstract_inverted_index);

          const authors = (work.authorships || [])
            .slice(0, 5)
            .map((authorship) => authorship?.author?.display_name)
            .filter(Boolean);

          const doi = work.doi;
          const url =
            work.primary_location?.landing_page_url ||
            (doi ? `https://doi.org/${doi.replace('https://doi.org/', '')}` : null) ||
            `https://openalex.org/${work.id.replace('https://openalex.org/', '')}`;

          const journal = work.primary_location?.source?.display_name || '';

          results.push({
            id: workId,
            type: 'publication',
            source: 'OpenAlex',
            title: work.title,
            abstract: abstract.substring(0, 600),
            authors,
            year: work.publication_year || null,
            url,
            journal,
            citedByCount: work.cited_by_count || 0,
            isOpenAccess: work.open_access?.is_oa || false
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (err) {
        logger.error(`OpenAlex page ${page} error: ${err.message}`);
      }
    }
  }

  logger.info(`OpenAlex fetched ${results.length} works in ${Date.now() - startTime}ms`);
  return results;
}

function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') {
    return '';
  }

  try {
    const positions = [];

    for (const [word, posArray] of Object.entries(invertedIndex)) {
      for (const pos of posArray) {
        positions.push({ word, pos });
      }
    }

    positions.sort((a, b) => a.pos - b.pos);
    return positions.map((entry) => entry.word).join(' ');
  } catch {
    return '';
  }
}
