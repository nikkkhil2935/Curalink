import { useCallback, useState } from 'react';
import { api, extractApiError } from '@/utils/api.js';
import { useAppStore } from '@/store/useAppStore.js';

function normalizeConditions(values) {
  if (Array.isArray(values)) {
    return values.map((entry) => String(entry || '').trim()).filter(Boolean);
  }

  return String(values || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildPatchPayload(profilePatch = {}) {
  const payload = {};

  if (profilePatch.intent !== undefined) {
    payload.intent = String(profilePatch.intent || '').trim();
  }

  if (profilePatch.location !== undefined) {
    const location = profilePatch.location && typeof profilePatch.location === 'object'
      ? profilePatch.location
      : {};

    payload.location = {
      city: String(location.city || '').trim(),
      country: String(location.country || '').trim()
    };
  }

  if (profilePatch.demographics !== undefined) {
    const demographics = profilePatch.demographics && typeof profilePatch.demographics === 'object'
      ? profilePatch.demographics
      : {};

    payload.demographics = {
      age: Number.isFinite(Number(demographics.age)) ? Number(demographics.age) : null,
      ageRange: String(demographics.ageRange || '').trim(),
      sex: String(demographics.sex || '').trim(),
      conditions: normalizeConditions(demographics.conditions)
    };
  }

  return payload;
}

export function usePatientProfile(explicitSessionId = null) {
  const {
    currentSession,
    patientProfile,
    setSession,
    setPatientProfile,
    setSessionConflicts,
    setLivingBrief
  } = useAppStore();

  const resolvedSessionId = String(explicitSessionId || currentSession?._id || '').trim();

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [isLoadingBrief, setIsLoadingBrief] = useState(false);
  const [isLoadingConflicts, setIsLoadingConflicts] = useState(false);

  const savePatientProfile = useCallback(
    async (profilePatch = {}) => {
      if (!resolvedSessionId) {
        throw new Error('Missing session id.');
      }

      const payload = buildPatchPayload(profilePatch);
      if (!Object.keys(payload).length) {
        return currentSession;
      }

      setIsSavingProfile(true);
      setProfileError('');
      try {
        const { data } = await api.patch(`/sessions/${resolvedSessionId}`, payload);
        if (data?.session) {
          setSession(data.session);
        }

        const mergedProfile = {
          ...(patientProfile || {}),
          ...(profilePatch || {})
        };

        if (profilePatch.demographics) {
          mergedProfile.conditions = normalizeConditions(profilePatch.demographics.conditions);
        }

        setPatientProfile(mergedProfile);
        return data?.session || null;
      } catch (error) {
        const message = extractApiError(error, 'Unable to update patient profile.');
        setProfileError(message);
        throw new Error(message);
      } finally {
        setIsSavingProfile(false);
      }
    },
    [currentSession, patientProfile, resolvedSessionId, setPatientProfile, setSession]
  );

  const refreshSessionConflicts = useCallback(async () => {
    if (!resolvedSessionId) {
      return { totalConflicts: 0, outcomeGroups: [] };
    }

    setIsLoadingConflicts(true);
    try {
      const { data } = await api.get(`/sessions/${resolvedSessionId}/conflicts`);
      const payload = {
        totalConflicts: Number(data?.totalConflicts || 0),
        outcomeGroups: Array.isArray(data?.outcomeGroups) ? data.outcomeGroups : []
      };
      setSessionConflicts(payload);
      return payload;
    } finally {
      setIsLoadingConflicts(false);
    }
  }, [resolvedSessionId, setSessionConflicts]);

  const refreshLivingBrief = useCallback(async () => {
    if (!resolvedSessionId) {
      return null;
    }

    setIsLoadingBrief(true);
    try {
      const { data } = await api.get(`/sessions/${resolvedSessionId}/brief`);
      const brief = data?.brief?.generatedAt ? data.brief : null;
      setLivingBrief(brief);
      return brief;
    } catch {
      setLivingBrief(null);
      return null;
    } finally {
      setIsLoadingBrief(false);
    }
  }, [resolvedSessionId, setLivingBrief]);

  const regenerateLivingBrief = useCallback(async () => {
    if (!resolvedSessionId) {
      throw new Error('Missing session id.');
    }

    setIsLoadingBrief(true);
    try {
      const { data } = await api.post(`/sessions/${resolvedSessionId}/brief/generate`);
      const brief = data?.brief?.generatedAt ? data.brief : null;
      setLivingBrief(brief);
      return brief;
    } finally {
      setIsLoadingBrief(false);
    }
  }, [resolvedSessionId, setLivingBrief]);

  return {
    patientProfile,
    isSavingProfile,
    profileError,
    setProfileError,
    isLoadingBrief,
    isLoadingConflicts,
    savePatientProfile,
    refreshSessionConflicts,
    refreshLivingBrief,
    regenerateLivingBrief
  };
}

export default usePatientProfile;
