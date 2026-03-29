import type { PipedriveConnection } from '@pipeagent/shared';
import { supabase } from './supabase.js';
import { PipedriveClient } from '../pipedrive/client.js';
import { refreshAccessToken } from '../pipedrive/oauth.js';

const TABLE = 'connections';

export async function getConnection(id: string): Promise<PipedriveConnection | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }

  return data as PipedriveConnection;
}

export async function getConnectionByPipedriveUser(
  userId: number,
  companyId: number
): Promise<PipedriveConnection | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('pipedrive_user_id', userId)
    .eq('pipedrive_company_id', companyId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data as PipedriveConnection;
}

export async function upsertConnection(
  conn: Omit<PipedriveConnection, 'id' | 'created_at' | 'updated_at'> &
    Partial<Pick<PipedriveConnection, 'id'>>
): Promise<PipedriveConnection> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(conn, {
      onConflict: 'pipedrive_user_id,pipedrive_company_id',
    })
    .select('*')
    .single();

  if (error) throw error;

  return data as PipedriveConnection;
}

export async function getClientForConnection(
  connectionId: string
): Promise<PipedriveClient> {
  const connection = await getConnection(connectionId);
  if (!connection) {
    throw new Error(`Connection not found: ${connectionId}`);
  }

  const clientId = process.env.PIPEDRIVE_CLIENT_ID;
  const clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing PIPEDRIVE_CLIENT_ID or PIPEDRIVE_CLIENT_SECRET');
  }

  // Proactively refresh token
  let { access_token, api_domain } = connection;
  try {
    const refreshed = await refreshAccessToken(
      connection.refresh_token,
      clientId,
      clientSecret
    );
    access_token = refreshed.access_token;
    api_domain = refreshed.api_domain;

    // Persist refreshed tokens and api_domain
    await supabase
      .from(TABLE)
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        api_domain: refreshed.api_domain,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId);
  } catch {
    // If refresh fails, fall back to existing token
  }

  // api_domain is stored as full URL e.g. "https://company.pipedrive.com"
  return new PipedriveClient(api_domain, access_token);
}
