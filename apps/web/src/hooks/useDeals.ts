import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import type { PipedriveDeal } from '@pipeagent/shared';

export function useDeals() {
  const [deals, setDeals] = useState<PipedriveDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchDeals = async () => {
    setLoading(true);
    const res = await apiFetch('/deals');
    if (res.ok) {
      const data = await res.json();
      setDeals(Array.isArray(data) ? data : data?.deals ?? []);
    }
    setLoading(false);
  };
  useEffect(() => { fetchDeals(); }, []);
  return { deals, loading, refetch: fetchDeals };
}
