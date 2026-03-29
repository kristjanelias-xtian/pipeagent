const API_URL = import.meta.env.VITE_API_URL ?? '';

export function getConnectionId(): string | null {
  return localStorage.getItem('connectionId');
}

export function setConnectionId(id: string): void {
  localStorage.setItem('connectionId', id);
}

export async function apiFetch(path: string, options?: RequestInit) {
  const connectionId = getConnectionId();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(connectionId ? { 'X-Connection-Id': connectionId } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
