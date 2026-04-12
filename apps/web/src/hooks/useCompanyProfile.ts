import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import type { CompanyProfile } from '@pipeagent/shared';

export function useCompanyProfile() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/company-profile');
      const data = await res.json();
      setProfile(data.profile);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load company profile');
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(
    async (updates: Partial<CompanyProfile>) => {
      const res = await apiFetch('/company-profile', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      setProfile(data.profile);
      return data.profile as CompanyProfile;
    },
    [],
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { profile, loading, error, refetch, save };
}
