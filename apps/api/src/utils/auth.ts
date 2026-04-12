// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import type { UserRole } from '@azela-pos/shared';
import type { AuthUser } from '../types/fastify.js';

// Helper to safely get user from request
export function getUser(request: any): AuthUser {
  const user = (request as any).user;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user;
}

export async function authenticate(
  request: any,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
    const payload = request.user as any;
    if (!payload?.userId || !payload?.storeId) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
    request.user = {
      userId: payload.userId,
      storeId: payload.storeId,
      role: payload.role,
    };
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      if (!allowedRoles.includes(user.role)) {
        reply.code(403).send({ error: 'Forbidden' });
        return;
      }
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
  };
}

export async function getStoreAccess(
  userId: string,
  storeId: string
): Promise<{ hasAccess: boolean; isOwner: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { store: true },
  });

  if (!user || !user.isActive) {
    return { hasAccess: false, isOwner: false };
  }

  // Owner can access all stores
  if (user.role === 'OWNER') {
    return { hasAccess: true, isOwner: true };
  }

  // Others can only access their own store
  return {
    hasAccess: user.storeId === storeId,
    isOwner: false,
  };
}

