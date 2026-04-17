import axios from 'axios';
import logger from '../../lib/logger.js';

const BASE_URL = 'https://clinicaltrials.gov/api/v2/studies';

const STATUS_COLORS = {
  RECRUITING: 'green',
  ACTIVE_NOT_RECRUITING: 'yellow',
  COMPLETED: 'blue',
  NOT_YET_RECRUITING: 'orange',
  TERMINATED: 'red',
  SUSPENDED: 'red',
  WITHDRAWN: 'gray',
  ENROLLING_BY_INVITATION: 'purple'
};

export async function fetchFromClinicalTrials(
  condition,
  intervention = null,
  userLocation = null,
  maxResults = 100
) {
  if (!condition?.trim()) {
    return [];
  }

  const startTime = Date.now();
  logger.info(`ClinicalTrials searching: "${condition}"`);

  const results = [];
  const seen = new Set();

  const fetchConfigs = [
    { status: 'RECRUITING', size: 50 },
    {
      status: 'ACTIVE_NOT_RECRUITING,COMPLETED,NOT_YET_RECRUITING',
      size: 50
    }
  ];

  for (const config of fetchConfigs) {
    if (results.length >= maxResults) {
      break;
    }

    try {
      const params = {
        'query.cond': condition,
        'filter.overallStatus': config.status,
        pageSize: Math.min(config.size, maxResults),
        format: 'json',
        countTotal: true,
        fields: [
          'NCTId',
          'BriefTitle',
          'OfficialTitle',
          'OverallStatus',
          'Phase',
          'BriefSummary',
          'EligibilityCriteria',
          'Gender',
          'MinimumAge',
          'MaximumAge',
          'LocationFacility',
          'LocationCity',
          'LocationState',
          'LocationCountry',
          'CentralContactName',
          'CentralContactPhone',
          'CentralContactEMail',
          'StartDate',
          'CompletionDate',
          'StudyType'
        ].join(',')
      };

      if (intervention) {
        params['query.intr'] = intervention;
      }

      if (userLocation?.country) {
        params['query.locn'] = userLocation.country;
      }

      const { data } = await axios.get(BASE_URL, { params, timeout: 15000 });
      const studies = data?.studies || [];

      for (const study of studies) {
        if (results.length >= maxResults) {
          break;
        }

        const proto = study?.protocolSection;
        if (!proto) {
          continue;
        }

        const idModule = proto.identificationModule || {};
        const statusModule = proto.statusModule || {};
        const descModule = proto.descriptionModule || {};
        const eligModule = proto.eligibilityModule || {};
        const contactsModule = proto.contactsLocationsModule || {};
        const designModule = proto.designModule || {};

        const nctId = idModule.nctId || '';
        const uniqueId = `ct:${nctId}`;
        if (!nctId || seen.has(uniqueId)) {
          continue;
        }
        seen.add(uniqueId);

        const locations = [];
        const locationList = contactsModule.locations || [];
        const locationArray = Array.isArray(locationList) ? locationList : [locationList];
        for (const location of locationArray.slice(0, 5)) {
          if (location?.city || location?.country) {
            locations.push([location.city, location.state, location.country].filter(Boolean).join(', '));
          }
        }

        const contacts = [];
        const centralContacts = contactsModule.centralContacts || [];
        const contactArray = Array.isArray(centralContacts) ? centralContacts : [centralContacts];
        for (const contact of contactArray.slice(0, 2)) {
          if (!contact?.name) {
            continue;
          }

          contacts.push({
            name: contact.name,
            phone: contact.phone || '',
            email: contact.email || ''
          });
        }

        const isLocationRelevant = userLocation?.country
          ? locations.some((entry) => entry.toLowerCase().includes(userLocation.country.toLowerCase()))
          : false;

        const status = statusModule.overallStatus || 'UNKNOWN';

        results.push({
          id: uniqueId,
          type: 'trial',
          source: 'ClinicalTrials',
          title: idModule.briefTitle || idModule.officialTitle || '',
          abstract: (descModule.briefSummary || '').substring(0, 600),
          authors: [],
          year: statusModule.startDateStruct?.date
            ? Number.parseInt(statusModule.startDateStruct.date.split('-')[0], 10)
            : null,
          url: `https://clinicaltrials.gov/study/${nctId}`,
          status,
          statusColor: STATUS_COLORS[status] || 'gray',
          phase: designModule?.phases?.join(', ') || 'N/A',
          studyType: designModule.studyType || '',
          eligibility: (eligModule.eligibilityCriteria || '').substring(0, 400),
          gender: eligModule.sex || 'All',
          minAge: eligModule.minimumAge || '',
          maxAge: eligModule.maximumAge || '',
          locations,
          contacts,
          completionDate: statusModule.completionDateStruct?.date || '',
          isLocationRelevant
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (err) {
      logger.error(`ClinicalTrials fetch error: ${err.message}`);
    }
  }

  logger.info(`ClinicalTrials fetched ${results.length} studies in ${Date.now() - startTime}ms`);
  return results;
}
