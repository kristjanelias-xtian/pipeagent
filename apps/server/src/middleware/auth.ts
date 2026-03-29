import { Context, Next } from 'hono';
import { sign, verify } from 'hono/jwt';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface AuthPayload {
  connectionId: string;
  pipedriveUserId: number;
  companyId: number;
  exp: number;
}

export async function createSessionToken(payload: Omit<AuthPayload, 'exp'>): Promise<string> {
  return sign({ ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, JWT_SECRET);
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verify(token, JWT_SECRET) as AuthPayload;
    c.set('connectionId', payload.connectionId);
    c.set('pipedriveUserId', payload.pipedriveUserId);
    c.set('companyId', payload.companyId);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
}
