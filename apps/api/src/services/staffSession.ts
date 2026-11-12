import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@azela-pos/db';

const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS) || 7;

export function newStaffRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashStaffRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function hashesEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export type StaffSessionTokens = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
};

export async function createStaffSession(
  app: FastifyInstance,
  user: { id: string; storeId: string; role: string }
): Promise<StaffSessionTokens> {
  const refreshToken = newStaffRefreshToken();
  const session = await prisma.staffSession.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashStaffRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000),
    },
  });
  const accessToken = app.jwt.sign(
    { userId: user.id, storeId: user.storeId, role: user.role, sid: session.id },
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  return { accessToken, refreshToken, sessionId: session.id };
}

/**
 * Rotate refresh token. Reuse of an already-rotated token revokes all sessions for that user.
 */
export async function refreshStaffSession(
  app: FastifyInstance,
  refreshToken: string
): Promise<StaffSessionTokens> {
  const presentedHash = hashStaffRefreshToken(refreshToken);

  const session = await prisma.staffSession.findUnique({
    where: { refreshTokenHash: presentedHash },
    include: { user: { select: { id: true, storeId: true, role: true, isActive: true } } },
  });

  if (!session) {
    // Possible reuse of a rotated token — look for superseded hash
    const superseded = await prisma.staffSession.findFirst({
      where: { previousTokenHash: presentedHash },
      select: { userId: true },
    });
    if (superseded) {
      await revokeAllStaffSessions(superseded.userId, 'REFRESH_REUSE');
    }
    const err: any = new Error('Invalid token');
    err.statusCode = 401;
    throw err;
  }

  if (session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    const err: any = new Error('Invalid token');
    err.statusCode = 401;
    throw err;
  }

  if (!session.user.isActive) {
    await revokeAllStaffSessions(session.userId, 'USER_DISABLED');
    const err: any = new Error('Invalid token');
    err.statusCode = 401;
    throw err;
  }

  const next = newStaffRefreshToken();
  const nextHash = hashStaffRefreshToken(next);
  const updated = await prisma.staffSession.updateMany({
    where: {
      id: session.id,
      refreshTokenHash: session.refreshTokenHash,
      revokedAt: null,
    },
    data: {
      previousTokenHash: session.refreshTokenHash,
      refreshTokenHash: nextHash,
      lastUsedAt: new Date(),
    },
  });

  if (updated.count !== 1) {
    const err: any = new Error('Invalid token');
    err.statusCode = 401;
    throw err;
  }

  const accessToken = app.jwt.sign(
    {
      userId: session.user.id,
      storeId: session.user.storeId,
      role: session.user.role,
      sid: session.id,
    },
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  return { accessToken, refreshToken: next, sessionId: session.id };
}

export async function revokeStaffSession(sessionId: string, reason: string): Promise<void> {
  await prisma.staffSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

export async function revokeAllStaffSessions(userId: string, reason: string): Promise<void> {
  await prisma.staffSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

/** Prefer opaque hashed sessions; accept legacy JWT refresh once during migration. */
export async function refreshStaffOrLegacyJwt(
  app: FastifyInstance,
  refreshToken: string
): Promise<StaffSessionTokens & { legacy?: boolean }> {
  // Opaque tokens are base64url (~43 chars); JWT has dots
  if (!refreshToken.includes('.')) {
    return refreshStaffSession(app, refreshToken);
  }

  // Legacy JWT refresh — issue a real staff session and retire the JWT pattern
  let decoded: any;
  try {
    decoded = app.jwt.verify(refreshToken);
  } catch {
    const err: any = new Error('Invalid token');
    err.statusCode = 401;
    throw err;
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, storeId: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) {
    const err: any = new Error('Invalid token');
    err.statusCode = 401;
    throw err;
  }

  const tokens = await createStaffSession(app, user);
  return { ...tokens, legacy: true };
}

export function staffHashesEqual(a: string, b: string): boolean {
  return hashesEqual(a, b);
}
