import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';

export interface PipedriveLead {
  id: string;
  title: string;
  person_id: number | null;
  organization_id: number | null;
  label_ids?: string[];
}

export function useLeads(connectionId: string | null) {
  const [leads, setLeads] = useState<PipedriveLead[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLeads = useCallback(async () => {
    if (!connectionId) return;
    setLoading(true);
    try {
      const res = await apiFetch('/leads');
      if (!res.ok) return;
      const data = await res.json();
      setLeads(Array.isArray(data) ? data : data?.data ?? []);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, 30_000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  return { leads, loading, refetch: fetchLeads };
}
