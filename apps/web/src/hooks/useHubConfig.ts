import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

export function useHubConfig() {
  const [globalContext, setGlobalContext] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/hub-config').then(async res => {
      if (res.ok) {
        const data = await res.json();
        setGlobalContext(data.config?.global_context || '');
      }
      setLoading(false);
    });
  }, []);

  const save = async (text: string) => {
    setSaving(true);
    await apiFetch('/hub-config', { method: 'PUT', body: JSON.stringify({ global_context: text }) });
    setGlobalContext(text);
    setSaving(false);
  };

  return { globalContext, setGlobalContext, loading, saving, save };
}
