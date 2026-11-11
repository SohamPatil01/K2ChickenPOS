import type {} from '@fastify/jwt';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@azela-pos/db';
import { hashToken, newRefreshToken } from '../domain/otp.js';
import { HttpError } from '../errors.js';

export const ACCESS_TOKEN_TTL = process.env.MOBILE_ACCESS_TOKEN_TTL || '15m';
export const REFRESH_TOKEN_TTL_DAYS = Number(process.env.MOBILE_REFRESH_TOKEN_TTL_DAYS) || 60;
export const TOKEN_TYPE = 'CUSTOMER_APP';

export type SessionTokens = { accessToken: string; refreshToken: string; expiresIn: string; sessionId: string };

function signAccess(app: FastifyInstance, identityId: string, sessionId: string): string {
  return app.jwt.sign({ tokenType: TOKEN_TYPE, identityId, sid: sessionId }, { expiresIn: ACCESS_TOKEN_TTL });
}

export async function createSession(
  app: FastifyInstance,
  identityId: string,
  meta: { platform?: string; appVersion?: string }
): Promise<SessionTokens> {
  const refreshToken = newRefreshToken();
  const session = await prisma.customerSession.create({
    data: {
      identityId,
      refreshTokenHash: hashToken(refreshToken),
      platform: meta.platform?.slice(0, 16) ?? null,
      appVersion: meta.appVersion?.slice(0, 32) ?? null,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    },
  });
  return { accessToken: signAccess(app, identityId, session.id), refreshToken, expiresIn: ACCESS_TOKEN_TTL, sessionId: session.id };
}

/** Rotates the refresh token: the presented token stops working immediately. */
export async function refreshSession(app: FastifyInstance, refreshToken: string): Promise<SessionTokens> {
  const session = await prisma.customerSession.findUnique({ where: { refreshTokenHash: hashToken(refreshToken) } });
  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    throw new HttpError(401, 'SESSION_EXPIRED', 'Please sign in again');
  }
  const next = newRefreshToken();
  const updated = await prisma.customerSession.updateMany({
    where: { id: session.id, refreshTokenHash: session.refreshTokenHash, revokedAt: null },
    data: { refreshTokenHash: hashToken(next), lastUsedAt: new Date() },
  });
  if (updated.count !== 1) throw new HttpError(401, 'SESSION_EXPIRED', 'Please sign in again');
  return {
    accessToken: signAccess(app, session.identityId, session.id),
    refreshToken: next,
    expiresIn: ACCESS_TOKEN_TTL,
    sessionId: session.id,
  };
}

export async function revokeSession(sessionId: string, reason: string): Promise<void> {
  await prisma.$transaction([
    prisma.customerSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } }),
    prisma.pushDevice.updateMany({
      where: { sessionId, invalidatedAt: null },
      data: { invalidatedAt: new Date(), invalidReason: 'LOGOUT' },
    }),
  ]);
}

export async function revokeAllSessions(identityId: string, reason: string): Promise<void> {
  await prisma.$transaction([
    prisma.customerSession.updateMany({ where: { identityId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } }),
    prisma.pushDevice.updateMany({ where: { identityId, invalidatedAt: null }, data: { invalidatedAt: new Date(), invalidReason: reason } }),
  ]);
}

export async function assertSessionActive(sessionId: string, identityId: string): Promise<void> {
  const s = await prisma.customerSession.findUnique({ where: { id: sessionId }, select: { identityId: true, revokedAt: true, expiresAt: true } });
  if (!s || s.identityId !== identityId || s.revokedAt || s.expiresAt.getTime() < Date.now()) {
    throw new HttpError(401, 'SESSION_REVOKED', 'Please sign in again');
  }
}
