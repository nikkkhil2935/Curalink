function clamp(value, min = 0, max = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }

  return Math.min(max, Math.max(min, numeric));
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeArray(values) {
  if (Array.isArray(values)) {
    return values
      .map((value) => normalizeText(value))
      .filter(Boolean);
  }

  if (typeof values === 'string') {
    return values
      .split(',')
      .map((value) => normalizeText(value))
      .filter(Boolean);
  }

  return [];
}

function inferAgeFromRange(ageRange) {
  const normalized = normalizeText(ageRange).toLowerCase();
  if (!normalized) {
    return null;
  }

  const plusMatch = normalized.match(/(\d+)\s*\+/);
  if (plusMatch) {
    return Number(plusMatch[1]);
  }

  const rangeMatch = normalized.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return Math.round((start + end) / 2);
    }
  }

  const numberMatch = normalized.match(/(\d+)/);
  return numberMatch ? Number(numberMatch[1]) : null;
}

function inferAgeValue(demographics = {}) {
  const explicitAge = Number(demographics?.age);
  if (Number.isFinite(explicitAge) && explicitAge >= 0) {
    return explicitAge;
  }

  return inferAgeFromRange(demographics?.ageRange);
}

function inferAgeGroup(age) {
  if (!Number.isFinite(age)) {
    return 'adult';
  }

  if (age < 18) {
    return 'pediatric';
  }

  if (age > 65) {
    return 'geriatric';
  }

  return 'adult';
}

function buildPromptContext({ ageGroup, sexBias, locationContext, comorbidityKeywords }) {
  const parts = [`Age group: ${ageGroup}`];

  if (sexBias) {
    parts.push(`Sex profile: ${sexBias}`);
  }

  if (locationContext.country || locationContext.region) {
    parts.push(
      `Location focus: ${[locationContext.region, locationContext.country].filter(Boolean).join(', ')}`
    );
  }

  if (comorbidityKeywords.length) {
    parts.push(`Comorbidity focus: ${comorbidityKeywords.join(', ')}`);
  }

  return parts.join('. ');
}

export function buildPatientProfile(session = {}) {
  const demographics = session?.demographics || {};
  const location = session?.location || {};

  const age = inferAgeValue(demographics);
  const ageGroup = inferAgeGroup(age);

  const conditions = normalizeArray(demographics?.conditions).slice(0, 3);
  const comorbidityKeywords = [...conditions];

  let recencyBoost = 1;
  if (ageGroup === 'geriatric') {
    recencyBoost = 1.3;
    ['cardiovascular risk', 'renal function', 'polypharmacy'].forEach((keyword) => {
      if (!comorbidityKeywords.includes(keyword)) {
        comorbidityKeywords.push(keyword);
      }
    });
  }

  const locationContext = {
    country: normalizeText(location?.country),
    region: normalizeText(location?.region || location?.city)
  };

  const geographicBoost = locationContext.country ? 1.25 : 1;
  const sexBias = normalizeText(demographics?.sex) || null;
  const demographicFilter = [ageGroup, sexBias].filter(Boolean).join(':') || 'adult';

  const promptContext = buildPromptContext({
    ageGroup,
    sexBias,
    locationContext,
    comorbidityKeywords
  });

  return {
    ageGroup,
    sexBias,
    locationContext,
    comorbidityKeywords,
    retrievalBoosts: {
      geographicBoost: clamp(geographicBoost, 0.5, 2),
      recencyBoost: clamp(recencyBoost, 0.5, 2),
      demographicFilter
    },
    promptContext
  };
}

export default buildPatientProfile;
