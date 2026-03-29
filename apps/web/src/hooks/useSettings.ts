import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import type { BusinessProfile } from '@pipeagent/shared';

export function useSettings(connectionId: string | null) {
  const [settings, setSettings] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!connectionId) return;
    setLoading(true);
    try {
      const data = await apiFetch('/settings');
      setSettings({
        business_description: data.business_description,
        value_proposition: data.value_proposition,
        icp_criteria: data.icp_criteria,
        outreach_tone: data.outreach_tone,
      });
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = useCallback(async (updated: BusinessProfile) => {
    setSaving(true);
    try {
      await apiFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify(updated),
      });
      setSettings(updated);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, loading, saving, saveSettings, refetch: fetchSettings };
}
