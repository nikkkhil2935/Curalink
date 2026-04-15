# Curalink — Day 2 Implementation Plan
## Retrieval Engine: PubMed + OpenAlex + ClinicalTrials.gov + Normalization + Basic Ranking

---

## 🎯 Day 2 Goals
By end of Day 2 you should have:
- [ ] Intent Classifier working
- [ ] Query Expander working
- [ ] All 3 API fetchers implemented (PubMed, OpenAlex, ClinicalTrials.gov)
- [ ] Data normalizer converting all sources to unified SourceDoc format
- [ ] Basic re-ranker (keyword + recency + location scoring)
- [ ] Source cards rendering in Evidence Panel (with real data)
- [ ] Retrieval stats showing (e.g. "Fetched 487 candidates → showing top 8")
- [ ] SourceDocs being saved to MongoDB

**Time estimate: 9-11 hours**

---

## STEP 1: Intent Classifier (45 min)

### server/src/services/pipeline/intentClassifier.js
```javascript
/**
 * Classifies user query intent to optimize retrieval strategy.
 * Uses keyword matching + a simple scoring approach.
 * Can be upgraded to LLM-based classification in Day 3.
 */

const INTENT_PATTERNS = {
  TREATMENT: [
    'treatment', 'therapy', 'medication', 'drug', 'medicine', 'surgery',
    'procedure', 'intervention', 'cure', 'manage', 'heal', 'treat',
    'deep brain stimulation', 'chemotherapy', 'immunotherapy', 'radiation'
  ],
  DIAGNOSIS: [
    'diagnos', 'detect', 'test', 'screening', 'biomarker', 'symptom',
    'sign', 'identify', 'confirm', 'early detection', 'scan', 'mri', 'ct scan'
  ],
  SIDE_EFFECTS: [
    'side effect', 'adverse', 'risk', 'complication', 'danger', 'harm',
    'toxicity', 'interaction', 'contraindication', 'warning'
  ],
  PREVENTION: [
    'prevent', 'reduce risk', 'avoid', 'protection', 'vaccine', 'lifestyle',
    'diet', 'exercise', 'supplement', 'vitamin'
  ],
  RESEARCHERS: [
    'researcher', 'expert', 'specialist', 'doctor', 'scientist', 'who is',
    'top researcher', 'leading', 'pioneer', 'institution'
  ],
  CLINICAL_TRIALS: [
    'clinical trial', 'study', 'recruiting', 'enroll', 'participate',
    'trial near', 'ongoing study', 'phase', 'experimental'
  ]
};

export function classifyIntent(query, intent = '') {
  const combined = `${query} ${intent}`.toLowerCase();
  const scores = {};
  
  for (const [intentType, keywords] of Object.entries(INTENT_PATTERNS)) {
    scores[intentType] = keywords.reduce((score, kw) => {
      return combined.includes(kw.toLowerCase()) ? score + 1 : score;
    }, 0);
  }
  
  const topIntent = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)[0];
  
  return topIntent[1] > 0 ? topIntent[0] : 'GENERAL';
}

export function getRetrievalStrategy(intentType) {
  const strategies = {
    TREATMENT: { boostPublications: true, boostRecruiting: true, pubmedSort: 'relevance' },
    DIAGNOSIS: { boostPublications: true, boostCompleted: true, pubmedSort: 'relevance' },
    SIDE_EFFECTS: { boostPublications: true, pubmedFilters: 'adverse effects', pubmedSort: 'relevance' },
    PREVENTION: { boostPublications: true, pubmedSort: 'pub date' },
    RESEARCHERS: { boostPublications: true, fetchAuthorData: true, pubmedSort: 'relevance' },
    CLINICAL_TRIALS: { boostTrials: true, boostRecruiting: true, pubmedSort: 'pub date' },
    GENERAL: { balanced: true, pubmedSort: 'pub date' }
  };
  return strategies[intentType] || strategies.GENERAL;
}
```

---

## STEP 2: Query Expander (30 min)

### server/src/services/pipeline/queryExpander.js
```javascript
/**
 * Expands user input into optimized queries for each API source.
 */

export function expandQuery(disease, intent = '', intentType = 'GENERAL') {
  const cleanDisease = disease.trim();
  const cleanIntent = intent.trim();
  
  // Full compound query for keyword search
  const fullQuery = cleanIntent 
    ? `${cleanIntent} ${cleanDisease}` 
    : cleanDisease;
  
  // PubMed uses AND operator for better precision
  const pubmedQuery = cleanIntent
    ? `(${cleanIntent}) AND (${cleanDisease})`
    : cleanDisease;
  
  // Add intent-specific MeSH terms for PubMed
  const meshSuffixes = {
    TREATMENT: ' AND (therapy[MeSH] OR treatment[Title/Abstract])',
    DIAGNOSIS: ' AND (diagnosis[MeSH] OR diagnostic[Title/Abstract])',
    SIDE_EFFECTS: ' AND (adverse effects[MeSH])',
    PREVENTION: ' AND (prevention[MeSH] OR preventive[Title/Abstract])',
    CLINICAL_TRIALS: ' AND (clinical trial[pt])',
    GENERAL: '',
    RESEARCHERS: ''
  };
  
  const pubmedQueryEnhanced = pubmedQuery + (meshSuffixes[intentType] || '');
  
  // OpenAlex simple text search
  const openalexQuery = fullQuery;
  
  // ClinicalTrials.gov structured params
  const ctCondition = cleanDisease;
  const ctIntervention = cleanIntent || undefined;
  
  return {
    fullQuery,
    pubmedQuery: pubmedQueryEnhanced,
    openalexQuery,
    ctCondition,
    ctIntervention,
    intentType
  };
}
```

---

## STEP 3: PubMed API Fetcher (2 hours)

### server/src/services/apis/pubmed.js
```javascript
import axios from 'axios';
import { parseStringPromise } from 'xml2js';

const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const EMAIL = process.env.PUBMED_EMAIL || 'curalink@demo.com';
const BATCH_SIZE = 50; // efetch limit per batch

/**
 * Step 1: Search PubMed for IDs
 */
async function searchPubMed(query, maxResults = 200) {
  const url = `${BASE_URL}/esearch.fcgi`;
  const params = {
    db: 'pubmed',
    term: query,
    retmax: maxResults,
    sort: 'pub date',
    retmode: 'json',
    email: EMAIL
  };
  
  try {
    const { data } = await axios.get(url, { params, timeout: 15000 });
    return data.esearchresult?.idlist || [];
  } catch (err) {
    console.error('PubMed search error:', err.message);
    return [];
  }
}

/**
 * Step 2: Fetch article details in batches
 */
async function fetchPubMedDetails(ids) {
  if (!ids.length) return [];
  
  const results = [];
  
  // Process in batches of 50
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
      
      if (!articles) continue;
      
      const articleArray = Array.isArray(articles) ? articles : [articles];
      
      for (const article of articleArray) {
        const medline = article?.MedlineCitation;
        if (!medline) continue;
        
        const articleData = medline?.Article;
        const pmid = medline?.PMID?._ || medline?.PMID;
        
        // Extract title
        const title = articleData?.ArticleTitle?._ || articleData?.ArticleTitle || '';
        
        // Extract abstract
        let abstract = '';
        const abstractData = articleData?.Abstract?.AbstractText;
        if (typeof abstractData === 'string') {
          abstract = abstractData;
        } else if (Array.isArray(abstractData)) {
          abstract = abstractData.map(a => a?._ || a || '').join(' ');
        } else if (abstractData?._) {
          abstract = abstractData._;
        }
        
        // Extract authors
        const authorList = articleData?.AuthorList?.Author;
        const authors = [];
        if (authorList) {
          const authorArray = Array.isArray(authorList) ? authorList : [authorList];
          for (const author of authorArray.slice(0, 5)) {
            const lastName = author?.LastName || '';
            const foreName = author?.ForeName || author?.Initials || '';
            if (lastName) authors.push(`${lastName} ${foreName}`.trim());
          }
        }
        
        // Extract year
        const pubDate = articleData?.Journal?.JournalIssue?.PubDate;
        const year = parseInt(pubDate?.Year || pubDate?.MedlineDate?.substring(0, 4) || '0');
        
        // Extract journal
        const journal = articleData?.Journal?.Title || '';
        
        if (!title) continue;
        
        results.push({
          id: `pubmed:${pmid}`,
          type: 'publication',
          source: 'PubMed',
          title: String(title).replace(/<[^>]*>/g, ''), // strip HTML tags
          abstract: String(abstract).substring(0, 600),
          authors,
          year: year || null,
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          journal
        });
      }
      
      // Rate limiting: 3 requests/sec without API key
      await new Promise(r => setTimeout(r, 350));
      
    } catch (err) {
      console.error(`PubMed batch ${i} error:`, err.message);
    }
  }
  
  return results;
}

/**
 * Main PubMed retrieval function
 */
export async function fetchFromPubMed(query, maxResults = 200) {
  console.log(`🔍 PubMed: Searching "${query}" (max ${maxResults})`);
  const startTime = Date.now();
  
  const ids = await searchPubMed(query, maxResults);
  console.log(`📋 PubMed: Found ${ids.length} IDs`);
  
  const articles = await fetchPubMedDetails(ids);
  console.log(`✅ PubMed: Fetched ${articles.length} articles in ${Date.now() - startTime}ms`);
  
  return articles;
}
```

---

## STEP 4: OpenAlex API Fetcher (1.5 hours)

### server/src/services/apis/openalex.js
```javascript
import axios from 'axios';

const BASE_URL = 'https://api.openalex.org/works';
const POLITE_EMAIL = process.env.PUBMED_EMAIL || 'curalink@demo.com';

/**
 * Fetch publications from OpenAlex with pagination
 */
export async function fetchFromOpenAlex(query, targetCount = 200) {
  console.log(`🔍 OpenAlex: Searching "${query}" (target ${targetCount})`);
  const startTime = Date.now();
  
  const results = [];
  const perPage = 100;  // OpenAlex max is 200
  const pagesToFetch = Math.ceil(targetCount / perPage);
  
  // Fetch by relevance (page 1)
  // Fetch by recency (page 1) — different sort gives different results
  const fetchConfigs = [
    { sort: 'relevance_score:desc', pages: Math.min(pagesToFetch, 2) },
    { sort: 'publication_date:desc', pages: 1 }
  ];
  
  for (const config of fetchConfigs) {
    for (let page = 1; page <= config.pages; page++) {
      try {
        const params = {
          search: query,
          'per-page': perPage,
          page,
          sort: config.sort,
          'filter': 'from_publication_date:2015-01-01',  // last 10 years
          'mailto': POLITE_EMAIL,
          'select': 'id,title,abstract_inverted_index,authorships,publication_year,doi,primary_location,cited_by_count,open_access'
        };
        
        const { data } = await axios.get(BASE_URL, { params, timeout: 15000 });
        
        for (const work of (data.results || [])) {
          if (!work.title) continue;
          
          // Skip duplicates
          const workId = `openalex:${work.id?.replace('https://openalex.org/', '')}`;
          if (results.some(r => r.id === workId)) continue;
          
          // Reconstruct abstract from inverted index
          let abstract = '';
          if (work.abstract_inverted_index) {
            abstract = reconstructAbstract(work.abstract_inverted_index);
          }
          
          // Extract authors (up to 5)
          const authors = (work.authorships || [])
            .slice(0, 5)
            .map(a => a?.author?.display_name)
            .filter(Boolean);
          
          // Extract URL
          const doi = work.doi;
          const url = work.primary_location?.landing_page_url 
            || (doi ? `https://doi.org/${doi.replace('https://doi.org/', '')}` : null)
            || `https://openalex.org/${work.id?.replace('https://openalex.org/', '')}`;
          
          // Extract source/journal
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
        
        // Polite crawling delay
        await new Promise(r => setTimeout(r, 200));
        
      } catch (err) {
        console.error(`OpenAlex page ${page} error:`, err.message);
      }
    }
  }
  
  console.log(`✅ OpenAlex: Fetched ${results.length} works in ${Date.now() - startTime}ms`);
  return results;
}

/**
 * Reconstruct abstract text from OpenAlex inverted index format
 * Format: { "word": [position1, position2], ... }
 */
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  
  try {
    const positions = [];
    
    for (const [word, posArray] of Object.entries(invertedIndex)) {
      for (const pos of posArray) {
        positions.push({ word, pos });
      }
    }
    
    positions.sort((a, b) => a.pos - b.pos);
    return positions.map(p => p.word).join(' ');
  } catch {
    return '';
  }
}
```

---

## STEP 5: ClinicalTrials.gov API Fetcher (1.5 hours)

### server/src/services/apis/clinicaltrials.js
```javascript
import axios from 'axios';

const BASE_URL = 'https://clinicaltrials.gov/api/v2/studies';

const STATUS_COLORS = {
  'RECRUITING': 'green',
  'ACTIVE_NOT_RECRUITING': 'yellow',
  'COMPLETED': 'blue',
  'NOT_YET_RECRUITING': 'orange',
  'TERMINATED': 'red',
  'SUSPENDED': 'red',
  'WITHDRAWN': 'gray',
  'ENROLLING_BY_INVITATION': 'purple'
};

/**
 * Fetch clinical trials from ClinicalTrials.gov v2 API
 */
export async function fetchFromClinicalTrials(condition, intervention = null, userLocation = null, maxResults = 100) {
  console.log(`🔍 ClinicalTrials: Searching "${condition}" ${intervention ? '+ ' + intervention : ''}`);
  const startTime = Date.now();
  
  const results = [];
  
  // Fetch 1: Recruiting trials first (most valuable for users)
  // Fetch 2: All statuses for comprehensive coverage
  const fetchConfigs = [
    { status: 'RECRUITING', size: 50 },
    { status: 'ACTIVE_NOT_RECRUITING,COMPLETED,NOT_YET_RECRUITING', size: 50 }
  ];
  
  for (const config of fetchConfigs) {
    try {
      const params = {
        'query.cond': condition,
        'filter.overallStatus': config.status,
        'pageSize': config.size,
        'format': 'json',
        'countTotal': true,
        // Request specific fields for efficiency
        'fields': [
          'NCTId', 'BriefTitle', 'OverallStatus', 'Phase',
          'BriefSummary', 'EligibilityCriteria', 'Gender',
          'MinimumAge', 'MaximumAge', 'LocationFacility',
          'LocationCity', 'LocationCountry', 'CentralContactName',
          'CentralContactPhone', 'CentralContactEMail',
          'StartDate', 'CompletionDate', 'StudyType'
        ].join(',')
      };
      
      if (intervention) {
        params['query.intr'] = intervention;
      }
      
      if (userLocation?.country) {
        params['query.locn'] = userLocation.country;
      }
      
      const { data } = await axios.get(BASE_URL, { params, timeout: 15000 });
      
      const studies = data.studies || [];
      
      for (const study of studies) {
        const proto = study.protocolSection;
        if (!proto) continue;
        
        const idModule = proto.identificationModule || {};
        const statusModule = proto.statusModule || {};
        const descModule = proto.descriptionModule || {};
        const eligModule = proto.eligibilityModule || {};
        const contactsModule = proto.contactsLocationsModule || {};
        
        const nctId = idModule.nctId || '';
        
        // Skip if already added
        if (results.some(r => r.id === `ct:${nctId}`)) continue;
        
        // Extract locations
        const locations = [];
        const locationList = contactsModule.locations || [];
        for (const loc of (Array.isArray(locationList) ? locationList : [locationList]).slice(0, 5)) {
          if (loc?.city || loc?.country) {
            locations.push([loc?.city, loc?.state, loc?.country].filter(Boolean).join(', '));
          }
        }
        
        // Extract contacts
        const contacts = [];
        const centralContacts = contactsModule.centralContacts || [];
        for (const contact of (Array.isArray(centralContacts) ? centralContacts : [centralContacts]).slice(0, 2)) {
          if (contact?.name) {
            contacts.push({
              name: contact.name,
              phone: contact.phone || '',
              email: contact.email || ''
            });
          }
        }
        
        // Location relevance
        const isLocationRelevant = userLocation?.country 
          ? locations.some(l => l.toLowerCase().includes(userLocation.country.toLowerCase()))
          : false;
        
        const status = statusModule.overallStatus || 'UNKNOWN';
        
        results.push({
          id: `ct:${nctId}`,
          type: 'trial',
          source: 'ClinicalTrials',
          title: idModule.briefTitle || idModule.officialTitle || '',
          abstract: descModule.briefSummary?.substring(0, 600) || '',
          authors: [],
          year: statusModule.startDateStruct?.date 
            ? parseInt(statusModule.startDateStruct.date.split('-')[0]) 
            : null,
          url: `https://clinicaltrials.gov/study/${nctId}`,
          // Trial-specific
          status,
          statusColor: STATUS_COLORS[status] || 'gray',
          phase: proto.designModule?.phases?.join(', ') || 'N/A',
          studyType: proto.designModule?.studyType || '',
          eligibility: eligModule.eligibilityCriteria?.substring(0, 400) || '',
          gender: eligModule.sex || 'All',
          minAge: eligModule.minimumAge || '',
          maxAge: eligModule.maximumAge || '',
          locations,
          contacts,
          completionDate: statusModule.completionDateStruct?.date || '',
          isLocationRelevant
        });
      }
      
      await new Promise(r => setTimeout(r, 300));
      
    } catch (err) {
      console.error('ClinicalTrials fetch error:', err.message);
    }
  }
  
  console.log(`✅ ClinicalTrials: Fetched ${results.length} studies in ${Date.now() - startTime}ms`);
  return results;
}
```

---

## STEP 6: Normalizer + Deduplication (30 min)

### server/src/services/pipeline/normalizer.js
```javascript
/**
 * Normalize and deduplicate results from all sources into unified SourceDoc format
 */

export function normalizeAndDeduplicate(pubmedResults, openalexResults, ctResults) {
  const all = [...pubmedResults, ...openalexResults, ...ctResults];
  const seen = new Set();
  const deduped = [];
  
  for (const doc of all) {
    // Deduplicate by ID
    if (seen.has(doc.id)) continue;
    
    // Also deduplicate by title similarity (simple check)
    const titleKey = doc.title?.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
    if (titleKey && seen.has(`title:${titleKey}`)) continue;
    
    seen.add(doc.id);
    if (titleKey) seen.add(`title:${titleKey}`);
    
    // Ensure required fields have defaults
    deduped.push({
      ...doc,
      title: doc.title || 'Untitled',
      abstract: doc.abstract || '',
      authors: doc.authors || [],
      year: doc.year || null,
      url: doc.url || '#',
      relevanceScore: 0,
      recencyScore: computeRecencyScore(doc.year),
      locationScore: doc.isLocationRelevant ? 1.0 : 0,
      sourceCredibility: getSourceCredibility(doc.source),
      finalScore: 0
    });
  }
  
  return deduped;
}

function computeRecencyScore(year) {
  if (!year) return 0;
  const MIN_YEAR = 2000;
  const MAX_YEAR = new Date().getFullYear();
  return Math.max(0, Math.min(1, (year - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)));
}

function getSourceCredibility(source) {
  const credibility = { 'PubMed': 0.95, 'OpenAlex': 0.85, 'ClinicalTrials': 0.90 };
  return credibility[source] || 0.80;
}
```

---

## STEP 7: Re-Ranker (1.5 hours)

### server/src/services/pipeline/reranker.js
```javascript
/**
 * Hybrid re-ranker using keyword scoring + recency + location + source credibility.
 * Embedding-based scoring is added in Day 3 after LLM service is running.
 */

/**
 * Compute BM25-like keyword relevance score
 */
function computeKeywordScore(doc, queryTerms) {
  const text = `${doc.title} ${doc.abstract}`.toLowerCase();
  let score = 0;
  
  for (const term of queryTerms) {
    const termLower = term.toLowerCase();
    const titleMatches = (doc.title?.toLowerCase().split(termLower).length - 1) || 0;
    const abstractMatches = (doc.abstract?.toLowerCase().split(termLower).length - 1) || 0;
    
    // Title matches weighted 3x
    score += titleMatches * 3;
    score += abstractMatches * 1;
  }
  
  return Math.min(1, score / (queryTerms.length * 4));  // normalize to 0-1
}

/**
 * Boost score for publications based on citation count (OpenAlex only)
 */
function computeCitationBoost(doc) {
  if (doc.source !== 'OpenAlex' || !doc.citedByCount) return 0;
  return Math.min(0.2, doc.citedByCount / 1000);  // max 0.2 boost
}

/**
 * Main re-ranking function
 */
export function rerankCandidates(candidates, queryTerms, intentType, userLocation = null) {
  const WEIGHTS = {
    TREATMENT: { relevance: 0.50, recency: 0.30, location: 0.10, credibility: 0.10 },
    CLINICAL_TRIALS: { relevance: 0.35, recency: 0.20, location: 0.30, credibility: 0.15 },
    RESEARCHERS: { relevance: 0.60, recency: 0.20, location: 0.05, credibility: 0.15 },
    DIAGNOSIS: { relevance: 0.55, recency: 0.25, location: 0.05, credibility: 0.15 },
    PREVENTION: { relevance: 0.50, recency: 0.30, location: 0.05, credibility: 0.15 },
    GENERAL: { relevance: 0.45, recency: 0.30, location: 0.10, credibility: 0.15 }
  };
  
  const weights = WEIGHTS[intentType] || WEIGHTS.GENERAL;
  
  const scored = candidates.map(doc => {
    // Keyword relevance
    const keywordScore = computeKeywordScore(doc, queryTerms);
    
    // Location scoring for trials
    let locationScore = doc.locationScore || 0;
    if (userLocation?.country && doc.type === 'trial' && doc.locations) {
      const matchesCountry = doc.locations.some(l => 
        l.toLowerCase().includes(userLocation.country.toLowerCase())
      );
      const matchesCity = userLocation?.city && doc.locations.some(l =>
        l.toLowerCase().includes(userLocation.city.toLowerCase())
      );
      locationScore = matchesCity ? 1.0 : matchesCountry ? 0.8 : 0;
    }
    
    // Citation boost
    const citationBoost = computeCitationBoost(doc);
    
    // Recruiting status boost for trials
    const recruitingBoost = (doc.type === 'trial' && doc.status === 'RECRUITING') ? 0.1 : 0;
    
    // Compute final score
    const finalScore = 
      weights.relevance * keywordScore +
      weights.recency * doc.recencyScore +
      weights.location * locationScore +
      weights.credibility * doc.sourceCredibility +
      citationBoost +
      recruitingBoost;
    
    return { ...doc, relevanceScore: keywordScore, locationScore, finalScore };
  });
  
  return scored.sort((a, b) => b.finalScore - a.finalScore);
}

/**
 * Select top docs for RAG context
 * Ensures a mix of publication types and sources
 */
export function selectForContext(rankedDocs, maxPubs = 8, maxTrials = 5) {
  const publications = rankedDocs.filter(d => d.type === 'publication').slice(0, maxPubs);
  const trials = rankedDocs.filter(d => d.type === 'trial').slice(0, maxTrials);
  return [...publications, ...trials];
}

/**
 * Compute evidence strength from selected sources
 */
export function computeEvidenceStrength(sources) {
  const count = sources.length;
  const avgYear = sources.reduce((s, d) => s + (d.year || 2015), 0) / (count || 1);
  const recencyScore = (avgYear - 2015) / (2025 - 2015);
  const sourceVariety = new Set(sources.map(s => s.source)).size;
  
  const score = (Math.min(count, 15) / 15) * 0.4 + recencyScore * 0.4 + (sourceVariety / 3) * 0.2;
  
  if (score >= 0.65) return { label: 'STRONG', emoji: '🟢', description: 'Strong evidence from multiple recent sources' };
  if (score >= 0.35) return { label: 'MODERATE', emoji: '🟡', description: 'Moderate evidence, consider consulting a specialist' };
  return { label: 'LIMITED', emoji: '🔴', description: 'Limited evidence, emerging research area' };
}
```

---

## STEP 8: Pipeline Orchestrator (Day 2 version — no LLM yet) (1 hour)

### server/src/services/pipeline/orchestrator.js
```javascript
import { classifyIntent, getRetrievalStrategy } from './intentClassifier.js';
import { expandQuery } from './queryExpander.js';
import { fetchFromPubMed } from '../apis/pubmed.js';
import { fetchFromOpenAlex } from '../apis/openalex.js';
import { fetchFromClinicalTrials } from '../apis/clinicaltrials.js';
import { normalizeAndDeduplicate } from './normalizer.js';
import { rerankCandidates, selectForContext, computeEvidenceStrength } from './reranker.js';
import SourceDoc from '../../models/SourceDoc.js';
import Analytics from '../../models/Analytics.js';

export async function runRetrievalPipeline(session, userMessage) {
  const startTime = Date.now();
  
  // 1. Classify intent
  const intentType = classifyIntent(userMessage, session.intent);
  const strategy = getRetrievalStrategy(intentType);
  
  // 2. Expand query
  const expanded = expandQuery(session.disease, userMessage || session.intent, intentType);
  
  // 3. Parallel retrieval from all 3 sources
  console.log(`🚀 Starting parallel retrieval for: "${expanded.fullQuery}"`);
  const [pubmedResults, openalexResults, ctResults] = await Promise.all([
    fetchFromPubMed(expanded.pubmedQuery, 200),
    fetchFromOpenAlex(expanded.openalexQuery, 200),
    fetchFromClinicalTrials(
      expanded.ctCondition, 
      expanded.ctIntervention, 
      session.location,
      100
    )
  ]);
  
  // 4. Stats before filtering
  const stats = {
    pubmedFetched: pubmedResults.length,
    openalexFetched: openalexResults.length,
    ctFetched: ctResults.length,
    totalCandidates: pubmedResults.length + openalexResults.length + ctResults.length
  };
  console.log(`📊 Retrieved: PubMed=${stats.pubmedFetched}, OpenAlex=${stats.openalexFetched}, CT=${stats.ctFetched}, Total=${stats.totalCandidates}`);
  
  // 5. Normalize + deduplicate
  const normalized = normalizeAndDeduplicate(pubmedResults, openalexResults, ctResults);
  
  // 6. Re-rank
  const queryTerms = expanded.fullQuery.split(' ').filter(t => t.length > 3);
  const ranked = rerankCandidates(normalized, queryTerms, intentType, session.location);
  
  // 7. Select context docs
  const contextDocs = selectForContext(ranked, 8, 5);
  stats.rerankedTo = contextDocs.length;
  
  // 8. Compute evidence strength
  const evidenceStrength = computeEvidenceStrength(contextDocs);
  
  // 9. Save SourceDocs to MongoDB (upsert)
  const upsertOps = contextDocs.map(doc => ({
    updateOne: {
      filter: { _id: doc.id },
      update: {
        $set: { ...doc, _id: doc.id },
        $inc: { timesUsed: 1 },
        $addToSet: { queryAssociations: expanded.fullQuery }
      },
      upsert: true
    }
  }));
  if (upsertOps.length) await SourceDoc.bulkWrite(upsertOps).catch(console.error);
  
  stats.timeTakenMs = Date.now() - startTime;
  
  // 10. Log analytics
  await Analytics.create({
    event: 'query',
    disease: session.disease.toLowerCase(),
    intentType,
    sessionId: session._id,
    metadata: { stats, queryExpanded: expanded.fullQuery }
  }).catch(console.error);
  
  return {
    contextDocs,
    rankedAll: ranked,
    stats,
    evidenceStrength,
    intentType,
    expandedQuery: expanded
  };
}
```

---

## STEP 9: Update Query Route with Real Pipeline (45 min)

### server/src/routes/sessions.js — Add query endpoint
```javascript
// Add this route to the sessions router
import { runRetrievalPipeline } from '../services/pipeline/orchestrator.js';
import Message from '../models/Message.js';

router.post('/:id/query', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });
    
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    
    // Save user message
    await Message.create({ sessionId: session._id, role: 'user', text: message });
    
    // Run retrieval pipeline
    const { contextDocs, stats, evidenceStrength, intentType, expandedQuery } = 
      await runRetrievalPipeline(session, message);
    
    // Determine context badge for follow-up
    const isFollowUp = session.messageCount > 2;
    const contextBadge = isFollowUp ? `Using context: ${session.disease}` : null;
    
    // Create structured response text (Day 3: replace with LLM)
    const responseText = `Found ${stats.totalCandidates} research candidates across PubMed, OpenAlex, and ClinicalTrials.gov. ` +
      `After re-ranking, showing top ${stats.rerankedTo} most relevant results for "${session.disease}" — ` +
      `${expandedQuery.fullQuery}. Evidence strength: ${evidenceStrength.emoji} ${evidenceStrength.label}. ` +
      `(LLM synthesis enabled in Day 3)`;
    
    // Save assistant message
    const assistantMsg = await Message.create({
      sessionId: session._id,
      role: 'assistant',
      text: responseText,
      usedSourceIds: contextDocs.map(d => d.id),
      retrievalStats: stats,
      intentType,
      contextBadge,
      structuredAnswer: {
        condition_overview: `Research results for ${session.disease}`,
        evidence_strength: evidenceStrength.label,
        research_insights: [],
        clinical_trials: [],
        key_researchers: [],
        recommendations: 'LLM synthesis coming in Day 3',
        follow_up_suggestions: [
          `What are the latest treatments for ${session.disease}?`,
          `Are there clinical trials near ${session.location?.country || 'me'}?`,
          `What do researchers say about ${session.intent || 'this condition'}?`
        ]
      }
    });
    
    // Update session
    await Session.findByIdAndUpdate(req.params.id, {
      $inc: { messageCount: 2 },
      $push: { queryHistory: expandedQuery.fullQuery },
      updatedAt: new Date()
    });
    
    res.json({
      message: assistantMsg,
      sources: contextDocs,
      stats,
      evidenceStrength
    });
    
  } catch (err) { next(err); }
});
```

---

## STEP 10: Source Cards UI (1.5 hours)

### client/src/components/evidence/PublicationsTab.jsx
```jsx
import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

const SOURCE_COLORS = {
  PubMed: 'bg-blue-900 text-blue-300 border-blue-700',
  OpenAlex: 'bg-purple-900 text-purple-300 border-purple-700',
  ClinicalTrials: 'bg-green-900 text-green-300 border-green-700'
};

function PublicationCard({ doc, index }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-gray-500 bg-gray-800 px-2 py-0.5 rounded shrink-0">
          [P{index + 1}]
        </span>
        <span className={`text-xs px-2 py-0.5 rounded border ${SOURCE_COLORS[doc.source]}`}>
          {doc.source}
        </span>
        {doc.year && (
          <span className="text-xs text-gray-500 ml-auto shrink-0">{doc.year}</span>
        )}
      </div>
      
      <h4 className="text-sm font-medium text-white mb-1 leading-snug">
        {doc.title}
      </h4>
      
      {doc.authors?.length > 0 && (
        <p className="text-xs text-gray-500 mb-2">
          {doc.authors.slice(0, 3).join(', ')}{doc.authors.length > 3 ? ' et al.' : ''}
        </p>
      )}
      
      {/* Evidence strength mini badge */}
      {doc.finalScore > 0.7 && (
        <span className="text-xs text-green-400">🟢 Highly Relevant</span>
      )}
      
      {expanded && doc.abstract && (
        <p className="text-xs text-gray-400 mt-2 leading-relaxed border-t border-gray-800 pt-2">
          {doc.abstract}
        </p>
      )}
      
      <div className="flex items-center gap-2 mt-3">
        {doc.abstract && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-all"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Hide' : 'View Abstract'}
          </button>
        )}
        <a
          href={doc.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-all ml-auto"
        >
          Open <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}

export default function PublicationsTab({ sources }) {
  return (
    <div className="space-y-3">
      {sources.length === 0 ? (
        <p className="text-center text-gray-600 text-sm mt-8">No publications found</p>
      ) : (
        <>
          <p className="text-xs text-gray-600 mb-3">
            Showing top {sources.length} publications ranked by relevance + recency
          </p>
          {sources.map((doc, i) => <PublicationCard key={doc.id} doc={doc} index={i} />)}
        </>
      )}
    </div>
  );
}
```

### client/src/components/evidence/TrialsTab.jsx
```jsx
import { ExternalLink, MapPin, Clock } from 'lucide-react';

const STATUS_STYLES = {
  RECRUITING: 'text-green-400 bg-green-950 border-green-800',
  ACTIVE_NOT_RECRUITING: 'text-yellow-400 bg-yellow-950 border-yellow-800',
  COMPLETED: 'text-blue-400 bg-blue-950 border-blue-800',
  NOT_YET_RECRUITING: 'text-orange-400 bg-orange-950 border-orange-800',
  TERMINATED: 'text-red-400 bg-red-950 border-red-800'
};

function TrialCard({ doc, index }) {
  const statusStyle = STATUS_STYLES[doc.status] || 'text-gray-400 bg-gray-900 border-gray-700';
  
  return (
    <div className={`bg-gray-900 border rounded-xl p-4 transition-all ${
      doc.isLocationRelevant ? 'border-green-800 shadow-sm shadow-green-950' : 'border-gray-800 hover:border-gray-700'
    }`}>
      <div className="flex items-start gap-2 mb-2">
        <span className="text-xs font-mono text-gray-500 bg-gray-800 px-2 py-0.5 rounded shrink-0">
          [T{index + 1}]
        </span>
        <span className={`text-xs px-2 py-0.5 rounded border ${statusStyle} shrink-0`}>
          {doc.status?.replace(/_/g, ' ')}
        </span>
        {doc.isLocationRelevant && (
          <span className="text-xs text-green-400 flex items-center gap-1 ml-auto shrink-0">
            📍 Near You
          </span>
        )}
      </div>
      
      <h4 className="text-sm font-medium text-white mb-2 leading-snug">{doc.title}</h4>
      
      {doc.phase && doc.phase !== 'N/A' && (
        <p className="text-xs text-gray-500 mb-1">Phase: {doc.phase}</p>
      )}
      
      {doc.locations?.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
          <MapPin size={10} />
          {doc.locations.slice(0, 2).join(' | ')}
          {doc.locations.length > 2 && ` +${doc.locations.length - 2} more`}
        </div>
      )}
      
      {doc.contacts?.[0] && (
        <p className="text-xs text-gray-600 mb-2">
          Contact: {doc.contacts[0].name}
          {doc.contacts[0].email && ` — ${doc.contacts[0].email}`}
        </p>
      )}
      
      {doc.eligibility && (
        <p className="text-xs text-gray-500 mt-2 line-clamp-2">
          Eligibility: {doc.eligibility.substring(0, 150)}...
        </p>
      )}
      
      <a
        href={doc.url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-all mt-3"
      >
        View on ClinicalTrials.gov <ExternalLink size={10} />
      </a>
    </div>
  );
}

export default function TrialsTab({ sources }) {
  const recruiting = sources.filter(s => s.status === 'RECRUITING');
  const other = sources.filter(s => s.status !== 'RECRUITING');
  
  return (
    <div className="space-y-3">
      {sources.length === 0 ? (
        <p className="text-center text-gray-600 text-sm mt-8">No clinical trials found</p>
      ) : (
        <>
          {recruiting.length > 0 && (
            <div>
              <p className="text-xs text-green-500 font-medium mb-2">
                🟢 Currently Recruiting ({recruiting.length})
              </p>
              {recruiting.map((doc, i) => <TrialCard key={doc.id} doc={doc} index={i} />)}
            </div>
          )}
          {other.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 font-medium mb-2">Other Trials ({other.length})</p>
              {other.map((doc, i) => <TrialCard key={doc.id} doc={doc} index={i + recruiting.length} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

---

## STEP 11: Retrieval Stats Display in Sidebar

### client/src/components/sidebar/Sidebar.jsx
```jsx
import { useAppStore } from '@/store/useAppStore';
import { useParams, useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const { currentSession, messages } = useAppStore();
  const navigate = useNavigate();
  
  // Get stats from last assistant message
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
  const stats = lastAssistantMsg?.retrievalStats;
  
  return (
    <div className="w-64 border-r border-gray-800 flex flex-col p-4 gap-4">
      {/* Session Info */}
      {currentSession && (
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Session</h3>
          <div className="bg-gray-900 rounded-lg p-3 space-y-1">
            <p className="text-sm font-medium text-white">{currentSession.disease}</p>
            {currentSession.intent && (
              <p className="text-xs text-gray-400">Focus: {currentSession.intent}</p>
            )}
            {currentSession.location?.country && (
              <p className="text-xs text-gray-500">📍 {currentSession.location.city}, {currentSession.location.country}</p>
            )}
          </div>
        </div>
      )}
      
      {/* Retrieval Stats */}
      {stats && (
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Retrieval Stats</h3>
          <div className="space-y-2">
            {[
              { label: 'Total Candidates', value: stats.totalCandidates, color: 'text-blue-400' },
              { label: 'PubMed', value: stats.pubmedFetched, color: 'text-blue-300' },
              { label: 'OpenAlex', value: stats.openalexFetched, color: 'text-purple-300' },
              { label: 'ClinicalTrials', value: stats.ctFetched, color: 'text-green-300' },
              { label: 'Shown to You', value: stats.rerankedTo, color: 'text-yellow-300' }
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-xs text-gray-600">{item.label}</span>
                <span className={`text-xs font-mono font-bold ${item.color}`}>{item.value}</span>
              </div>
            ))}
            {stats.timeTakenMs && (
              <p className="text-xs text-gray-700 pt-1 border-t border-gray-800">
                Retrieved in {(stats.timeTakenMs / 1000).toFixed(1)}s
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* Export button */}
      <div className="mt-auto">
        <button
          onClick={() => navigate('/analytics')}
          className="w-full text-xs py-2 border border-gray-700 rounded-lg text-gray-500 hover:text-white hover:border-gray-500 transition-all"
        >
          📊 Analytics Dashboard
        </button>
      </div>
    </div>
  );
}
```

---

## ✅ Day 2 Checklist

- [ ] Intent classifier correctly classifying "deep brain stimulation" as TREATMENT
- [ ] Query expander creating proper PubMed AND queries
- [ ] PubMed returning real articles (test: search "lung cancer" → should get 100+ IDs)
- [ ] OpenAlex returning real works (test: `/api/health` then manual fetch)
- [ ] ClinicalTrials returning real studies with locations
- [ ] All 3 fetchers running in parallel (check logs)
- [ ] Normalization deduplicating correctly
- [ ] Re-ranker scoring and sorting (check finalScore values in logs)
- [ ] `GET /api/sessions/:id/query` returning real sources array
- [ ] Evidence panel showing source cards from real data
- [ ] Publications tab showing PubMed + OpenAlex results
- [ ] Trials tab showing clinical trials with status badges
- [ ] Sidebar showing retrieval stats (e.g. "487 candidates → 13 shown")
- [ ] MongoDB SourceDocs collection has entries after a query

## 🚀 End of Day 2 Commit Message
```
feat: day 2 - full retrieval pipeline (pubmed+openalex+clinicaltrials), re-ranking, source cards UI
```
