/**
 * Build citation-indexed source snippets for LLM RAG prompts.
 */
export function buildRAGContext(contextDocs, disease, userMessage, session) {
  const publications = contextDocs.filter((doc) => doc.type === 'publication');
  const trials = contextDocs.filter((doc) => doc.type === 'trial');

  const sourceLines = [];
  const sourceIndex = {};

  publications.forEach((doc, index) => {
    const citationId = `P${index + 1}`;
    sourceIndex[citationId] = doc.id;

    const line = [
      `[${citationId}] ${doc.source} | ${doc.year || 'Year N/A'}`,
      `Title: ${doc.title}`,
      doc.authors?.length ? `Authors: ${doc.authors.slice(0, 3).join(', ')}` : '',
      doc.abstract ? `Abstract: ${doc.abstract.substring(0, 300)}` : '',
      `URL: ${doc.url}`
    ]
      .filter(Boolean)
      .join('\n');

    sourceLines.push(line);
  });

  trials.forEach((doc, index) => {
    const citationId = `T${index + 1}`;
    sourceIndex[citationId] = doc.id;

    const line = [
      `[${citationId}] ClinicalTrials.gov | Status: ${doc.status || 'UNKNOWN'}`,
      `Title: ${doc.title}`,
      doc.phase && doc.phase !== 'N/A' ? `Phase: ${doc.phase}` : '',
      doc.locations?.length ? `Locations: ${doc.locations.slice(0, 3).join(', ')}` : '',
      doc.eligibility ? `Eligibility: ${doc.eligibility.substring(0, 200)}` : '',
      doc.contacts?.[0]?.name
        ? `Contact: ${doc.contacts[0].name}${doc.contacts[0].email ? ` (${doc.contacts[0].email})` : ''}`
        : '',
      `URL: ${doc.url}`
    ]
      .filter(Boolean)
      .join('\n');

    sourceLines.push(line);
  });

  return {
    sourcesText: sourceLines.join('\n\n---\n\n'),
    sourceIndex,
    pubCount: publications.length,
    trialCount: trials.length,
    disease,
    userMessage,
    session
  };
}

export function buildSystemPrompt() {
  return `You are Curalink, an AI Medical Research Assistant. You help patients and caregivers understand medical research in a clear, empathetic way.

STRICT RULES:
1. ONLY use information from the SOURCES section below. Do NOT use your training knowledge.
2. Every research_insight and clinical_trial entry MUST include source_ids (e.g., ["P1", "P2"]).
3. Include confidence_breakdown entries for cited sources with normalized scores between 0 and 1.
4. If a claim cannot be supported by the provided sources, say: "Evidence not available in current research pool."
5. NEVER give direct medical advice or dosage recommendations. Always suggest consulting a healthcare provider.
6. Be empathetic, clear, and avoid excessive medical jargon.
7. Output MUST be valid JSON only. No text before or after the JSON.

OUTPUT FORMAT (respond ONLY with this JSON structure):
{
  "condition_overview": "2-3 sentence overview of the condition and what research shows",
  "evidence_strength": "LIMITED|MODERATE|STRONG",
  "research_insights": [
    {
      "insight": "Clear, plain-English finding from the research",
      "type": "TREATMENT|DIAGNOSIS|RISK|PREVENTION|GENERAL",
      "source_ids": ["P1"]
    }
  ],
  "clinical_trials": [
    {
      "summary": "What the trial is studying and why it matters",
      "status": "RECRUITING|COMPLETED|etc.",
      "location_relevant": true/false,
      "contact": "contact info if available",
      "source_ids": ["T1"]
    }
  ],
  "key_researchers": [
    "Dr. Name - Institution (based on publication authorship)"
  ],
  "recommendations": "Empathetic, non-prescriptive summary of what the patient should consider. Always end with: Please consult your healthcare provider.",
  "follow_up_suggestions": [
    "Specific question the patient might ask next (3 items)"
  ],
  "confidence_breakdown": [
    {
      "source_id": "P1|T1",
      "title": "Short source title",
      "relevance_score": 0.0,
      "credibility_score": 0.0,
      "recency_score": 0.0,
      "composite_score": 0.0
    }
  ]
}`;
}

export function buildUserPrompt(disease, userMessage, session, sourcesText, evidenceStrength, intentType) {
  const demographics = [];
  if (session.demographics?.age) {
    demographics.push(`Age: ${session.demographics.age}`);
  }
  if (session.demographics?.sex) {
    demographics.push(`Sex: ${session.demographics.sex}`);
  }

  const location = session.location?.city
    ? `${session.location.city}, ${session.location.country || ''}`.trim().replace(/,$/, '')
    : session.location?.country || 'Not specified';

  return `PATIENT PROFILE:
- Primary Condition: ${disease}
- Location: ${location}
${demographics.length > 0 ? `- ${demographics.join('\n- ')}` : ''}
- Query Intent Type: ${intentType}
- Evidence Available: ${evidenceStrength.label}

USER QUESTION:
"${userMessage}"

SOURCES (use ONLY these):
${sourcesText}

Now provide a structured JSON response following the output format.`;
}

// Backward-compatible wrapper for older imports.
export function packageContext({ publications = [], trials = [] }) {
  const all = [...publications, ...trials].slice(0, 13);
  const ragContext = buildRAGContext(all, '', '', {});

  return {
    items: all,
    snippets: all.map((item, index) => `S${index + 1}: ${item.title || 'Untitled source'}`),
    ...ragContext
  };
}
