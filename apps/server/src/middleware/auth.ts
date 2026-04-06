import { Context, Next } from 'hono';
import { sign, verify } from 'hono/jwt';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthPayload {
  connectionId: string;
  pipedriveUserId: number;
  companyId: number;
  exp: number;
}

export type AppVariables = {
  connectionId: string;
  pipedriveUserId: number;
  companyId: number;
};

export type AppEnv = { Variables: AppVariables };

export async function createSessionToken(payload: Omit<AuthPayload, 'exp'>): Promise<string> {
  return sign({ ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, JWT_SECRET);
}

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verify(token, JWT_SECRET, 'HS256') as unknown as AuthPayload;
    c.set('connectionId', payload.connectionId);
    c.set('pipedriveUserId', payload.pipedriveUserId);
    c.set('companyId', payload.companyId);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
}
