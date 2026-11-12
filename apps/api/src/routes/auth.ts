// @ts-nocheck
import { FastifyInstance, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '@azela-pos/db';
import { loginSchema } from '@azela-pos/shared';
import { getUser } from '../utils/auth.js';
import { AUTH_ROUTE_RATE_LIMIT } from '../lib/securityConfig.js';
import {
  createStaffSession,
  refreshStaffOrLegacyJwt,
  revokeAllStaffSessions,
  revokeStaffSession,
} from '../services/staffSession.js';

export async function authRoutes(fastify: FastifyInstance) {
  // Login picker: id/name/phone/role only — required by POS login UI. No CDN cache.
  fastify.get(
    '/profiles',
    {
      config: {
        rateLimit: AUTH_ROUTE_RATE_LIMIT.profiles,
      },
    },
    async (_request, reply: FastifyReply) => {
      try {
        const users = await prisma.user.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
          },
          orderBy: { name: 'asc' },
        });

        const roleOrder = { OWNER: 0, MANAGER: 1, CASHIER: 2, DRIVER: 3 };
        const sortedUsers = users.sort((a, b) => {
          const roleDiff =
            (roleOrder[a.role as keyof typeof roleOrder] ?? 99) -
            (roleOrder[b.role as keyof typeof roleOrder] ?? 99);
          return roleDiff !== 0 ? roleDiff : a.name.localeCompare(b.name);
        });

        reply.header('Cache-Control', 'private, no-store');
        return sortedUsers;
      } catch (error: any) {
        console.error('[Auth] Failed to fetch profiles:', error?.message || error);
        reply.header('Cache-Control', 'private, no-store');
        reply.code(500).send({ error: 'Failed to fetch profiles' });
      }
    }
  );

  fastify.post(
    '/login',
    {
      config: {
        rateLimit: AUTH_ROUTE_RATE_LIMIT.login,
      },
    },
    async (request: any, reply: FastifyReply) => {
      try {
        const body = loginSchema.parse(request.body as any);

        const user = await prisma.user.findUnique({
          where: { phone: body.phone },
          include: {
            store: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        });

        // Uniform response — do not leak whether phone exists
        if (!user || !user.isActive || !user.passwordHash) {
          reply.code(401).send({ error: 'Invalid credentials' });
          return;
        }

        const valid = await bcrypt.compare(body.password, user.passwordHash);
        if (!valid) {
          reply.code(401).send({ error: 'Invalid credentials' });
          return;
        }

        const tokens = await createStaffSession(fastify, {
          id: user.id,
          storeId: user.storeId,
          role: user.role,
        });

        return {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            role: user.role,
            storeId: user.storeId,
            store: {
              id: user.store.id,
              name: user.store.name,
              type: user.store.type,
            },
          },
        };
      } catch (error: any) {
        if (error?.name === 'ZodError') {
          reply.code(400).send({ error: 'Invalid login payload' });
          return;
        }
        console.error('[Auth] Login error:', error?.message || error);
        reply.code(500).send({ error: 'Login failed' });
      }
    }
  );

  fastify.post(
    '/refresh',
    {
      config: {
        rateLimit: AUTH_ROUTE_RATE_LIMIT.refresh,
      },
    },
    async (request: any, reply: FastifyReply) => {
      try {
        const refreshToken = String((request.body as any)?.refreshToken || '');
        if (!refreshToken) {
          reply.code(401).send({ error: 'Invalid token' });
          return;
        }

        const tokens = await refreshStaffOrLegacyJwt(fastify, refreshToken);
        return {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        };
      } catch {
        reply.code(401).send({ error: 'Invalid token' });
      }
    }
  );

  fastify.post('/logout', { preHandler: [fastify.authenticate] }, async (request: any) => {
    const payload = request.user as any;
    const sid = payload?.sid;
    if (sid) {
      await revokeStaffSession(sid, 'LOGOUT');
    } else if (payload?.userId) {
      await revokeAllStaffSessions(payload.userId, 'LOGOUT');
    }
    return { message: 'Logged out' };
  });

  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const user = await prisma.user.findUnique({
      where: { id: (getUser(request) as any).userId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        storeId: true,
        isActive: true,
        store: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    const { isActive: _a, ...safe } = user;
    return safe;
  });
}
