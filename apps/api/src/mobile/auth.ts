import type {} from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { HttpError } from './errors.js';
import { loadIdentity, type IdentityContext } from './services/identity.js';
import { assertSessionActive, TOKEN_TYPE } from './services/session.js';

type MobileClaims = { tokenType?: string; identityId?: string; sid?: string };

declare module 'fastify' {
  interface FastifyRequest {
    mobileCtx?: IdentityContext & { sessionId: string };
  }
}

async function resolve(request: FastifyRequest): Promise<(IdentityContext & { sessionId: string }) | null> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  let claims: MobileClaims;
  try {
    claims = (await request.jwtVerify()) as MobileClaims;
  } catch {
    throw new HttpError(401, 'TOKEN_INVALID', 'Session expired');
  }
  // Staff (userId) and portal (tokenType CUSTOMER) tokens are rejected here, and these tokens
  // are rejected by the staff `authenticate` hook (no userId) — the token types never cross.
  if (claims.tokenType !== TOKEN_TYPE || !claims.identityId || !claims.sid) {
    throw new HttpError(401, 'TOKEN_INVALID', 'Session expired');
  }
  await assertSessionActive(claims.sid, claims.identityId);
  const ctx = await loadIdentity(claims.identityId);
  return { ...ctx, sessionId: claims.sid };
}

/** Customer-scoped endpoints: authorization is enforced HERE, never by the app. */
export async function requireCustomer(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const ctx = await resolve(request);
  if (!ctx) throw new HttpError(401, 'UNAUTHORIZED', 'Please sign in');
  request.mobileCtx = ctx;
}

export async function optionalCustomer(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const ctx = await resolve(request).catch(() => null);
  if (ctx) request.mobileCtx = ctx;
}

export function ctxOf(request: FastifyRequest): IdentityContext & { sessionId: string } {
  if (!request.mobileCtx) throw new HttpError(401, 'UNAUTHORIZED', 'Please sign in');
  return request.mobileCtx;
}
