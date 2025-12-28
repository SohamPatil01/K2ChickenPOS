import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import type { UserRole } from '@azela-pos/shared';

export interface AuthUser {
  userId: string;
  storeId: string;
  role: UserRole;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
    const payload = request.user as any;
    if (!payload?.userId || !payload?.storeId) {
      reply.code(401).send({ error: 'Invalid token' });
      return;
    }
    request.user = {
      userId: payload.userId,
      storeId: payload.storeId,
      role: payload.role,
    };
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
    if (!allowedRoles.includes(request.user.role)) {
      reply.code(403).send({ error: 'Forbidden' });
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

