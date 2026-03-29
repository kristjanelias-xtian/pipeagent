import { useState, useEffect } from 'react';
import { getConnectionId, setConnectionId, apiFetch } from '../lib/api';

export function useConnection() {
  const [connectionId, setConnId] = useState<string | null>(getConnectionId());
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ api_domain: string; pipedrive_user_id: number } | null>(null);

  useEffect(() => {
    // Check URL params for connection_id (OAuth callback redirect)
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('connection_id');
    if (idFromUrl) {
      setConnectionId(idFromUrl);
      setConnId(idFromUrl);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!connectionId) {
      setLoading(false);
      return;
    }
    apiFetch('/auth/me')
      .then((data) => setUser(data))
      .catch(() => {
        localStorage.removeItem('connectionId');
        setConnId(null);
      })
      .finally(() => setLoading(false));
  }, [connectionId]);

  const login = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    window.location.href = `${apiUrl}/auth/login`;
  };

  const logout = () => {
    localStorage.removeItem('connectionId');
    setConnId(null);
    setUser(null);
  };

  return { connectionId, user, loading, login, logout };
}
