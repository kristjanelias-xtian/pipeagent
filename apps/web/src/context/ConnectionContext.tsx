import { createContext, useContext } from 'react';

interface ConnectionUser {
  id: string;
  api_domain: string;
  pipedrive_user_id: number;
  pipedrive_company_id: number;
}

interface ConnectionValue {
  connectionId: string | null;
  authenticated: boolean;
  user: ConnectionUser | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
}

export const ConnectionContext = createContext<ConnectionValue | null>(null);

export function useConnectionContext(): ConnectionValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error('useConnectionContext must be used inside ConnectionContext.Provider');
  return ctx;
}
