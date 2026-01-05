// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '@azela-pos/db';
import { loginSchema } from '@azela-pos/shared';
import { getUser } from '../utils/auth.js';

interface LoginBody {
  phone: string;
  password: string;
}

export async function authRoutes(fastify: FastifyInstance) {
  // Public endpoint to get login profiles (for login screen)
  fastify.get('/profiles', async (request: FastifyRequest, reply: FastifyReply) => {
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

      // Sort by role priority: OWNER, MANAGER, CASHIER, DRIVER
      const roleOrder = { OWNER: 0, MANAGER: 1, CASHIER: 2, DRIVER: 3 };
      const sortedUsers = users.sort((a, b) => {
        const roleDiff = (roleOrder[a.role as keyof typeof roleOrder] || 99) - (roleOrder[b.role as keyof typeof roleOrder] || 99);
        return roleDiff !== 0 ? roleDiff : a.name.localeCompare(b.name);
      });

      return sortedUsers;
    } catch (error: any) {
      reply.code(500).send({ error: 'Failed to fetch profiles' });
    }
  });

  fastify.post('/login', async (request: any, reply: FastifyReply) => {
    try {
      const body = loginSchema.parse(request.body as any);
      
      console.log('[Auth] Login attempt for phone:', body.phone);

      const user = await prisma.user.findUnique({
        where: { phone: body.phone },
        include: { store: true },
      });

      if (!user) {
        console.log('[Auth] User not found for phone:', body.phone);
        reply.code(401).send({ error: 'Invalid credentials' });
        return;
      }

      if (!user.isActive) {
        console.log('[Auth] User is inactive:', body.phone);
        reply.code(401).send({ error: 'Invalid credentials' });
        return;
      }

      if (!user.passwordHash) {
        console.log('[Auth] User has no password hash:', body.phone);
        reply.code(401).send({ error: 'Invalid credentials' });
        return;
      }

      const valid = await bcrypt.compare(body.password, user.passwordHash);
      if (!valid) {
        console.log('[Auth] Password mismatch for phone:', body.phone);
        reply.code(401).send({ error: 'Invalid credentials' });
        return;
      }

      console.log('[Auth] Login successful for:', user.name, user.phone);

      const accessToken = fastify.jwt.sign(
        {
          userId: user.id,
          storeId: user.storeId,
          role: user.role,
        },
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
      );

      const refreshToken = fastify.jwt.sign(
        {
          userId: user.id,
          storeId: user.storeId,
          role: user.role,
        },
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
      );

      return {
        accessToken,
        refreshToken,
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
      console.error('[Auth] Login error:', error);
      reply.code(500).send({ error: 'Login failed', details: error.message });
    }
  });

  fastify.post('/refresh', async (request: any, reply: FastifyReply) => {
    try {
      const decoded = fastify.jwt.verify((request.body as any).refreshToken) as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { store: true },
      });

      if (!user || !user.isActive) {
        reply.code(401).send({ error: 'Invalid token' });
        return;
      }

      const accessToken = fastify.jwt.sign(
        {
          userId: user.id,
          storeId: user.storeId,
          role: user.role,
        },
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
      );

      return { accessToken };
    } catch (err) {
      reply.code(401).send({ error: 'Invalid token' });
    }
  });

  fastify.post('/logout', async () => {
    // In a stateless JWT system, logout is handled client-side
    // For enhanced security, you could maintain a token blacklist
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
        store: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!user) {
      reply.code(404).send({ error: 'User not found' });
      return;
    }

    return user;
  });

  // Temporary admin endpoint to reset all passwords to defaults
  // SECURITY: Remove this endpoint after resetting passwords in production
  // Usage: POST /api/v1/auth/reset-passwords?secret=YOUR_SECRET
  fastify.post('/reset-passwords', async (request: any, reply: FastifyReply) => {
    try {
      // Require a secret to prevent unauthorized access
      const resetSecret = process.env.PASSWORD_RESET_SECRET || 'CHANGE_THIS_IN_PRODUCTION';
      const providedSecret = (request.query as any).secret || (request.body as any).secret;

      if (providedSecret !== resetSecret) {
        reply.code(401).send({ error: 'Unauthorized: Invalid secret' });
        return;
      }

      console.log('[Auth] Resetting all passwords to defaults...');

      const defaultPasswords = {
        OWNER: '123456',
        MANAGER: '234567',
        CASHIER: '345678',
        DRIVER: '456789',
      };

      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
        },
      });

      const results = [];

      for (const user of users) {
        const defaultPassword = defaultPasswords[user.role as keyof typeof defaultPasswords];
        
        if (!defaultPassword) {
          results.push({ user: user.name, phone: user.phone, status: 'skipped', reason: `Unknown role: ${user.role}` });
          continue;
        }

        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash },
        });

        results.push({ user: user.name, phone: user.phone, role: user.role, password: defaultPassword, status: 'reset' });
      }

      console.log('[Auth] Password reset complete:', results.length, 'users updated');

      return {
        success: true,
        message: `Reset passwords for ${results.length} users`,
        results,
        defaultPasswords: {
          OWNER: '123456',
          MANAGER: '234567',
          CASHIER: '345678',
          DRIVER: '456789',
        },
      };
    } catch (error: any) {
      console.error('[Auth] Password reset error:', error);
      reply.code(500).send({ error: 'Failed to reset passwords', details: error.message });
    }
  });
}

