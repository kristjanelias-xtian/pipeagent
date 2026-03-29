import { useState, useEffect } from 'react';
import { getAuthToken, setAuthToken, clearAuth, apiFetch } from '../lib/api';

interface ConnectionUser {
  id: string;
  api_domain: string;
  pipedrive_user_id: number;
  pipedrive_company_id: number;
}

export function useConnection() {
  const [authenticated, setAuthenticated] = useState<boolean>(!!getAuthToken());
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<ConnectionUser | null>(null);

  useEffect(() => {
    // Check URL params for token (OAuth callback redirect)
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    if (tokenFromUrl) {
      setAuthToken(tokenFromUrl);
      setAuthenticated(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) {
      setLoading(false);
      return;
    }
    apiFetch('/me')
      .then((res) => {
        if (!res.ok) throw new Error('Not authenticated');
        return res.json();
      })
      .then((data: ConnectionUser) => setUser(data))
      .catch(() => {
        clearAuth();
        setAuthenticated(false);
      })
      .finally(() => setLoading(false));
  }, [authenticated]);

  const login = () => {
    window.location.href = '/auth/login';
  };

  const logout = () => {
    clearAuth();
    setAuthenticated(false);
    setUser(null);
  };

  return { connectionId: user?.id ?? null, authenticated, user, loading, login, logout };
}
