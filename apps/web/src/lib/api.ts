export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('auth_token', token);
}

export function clearAuth() {
  localStorage.removeItem('auth_token');
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  if (res.status === 401 && path !== '/me') {
    clearAuth();
    window.location.reload();
  }
  return res;
}
