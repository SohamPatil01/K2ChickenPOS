import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '@azela-pos/db';
import { loginSchema } from '@azela-pos/shared';

interface LoginBody {
  phone: string;
  password: string;
}

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
    const body = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { phone: body.phone },
      include: { store: true },
    });

    if (!user || !user.isActive) {
      reply.code(401).send({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      reply.code(401).send({ error: 'Invalid credentials' });
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
  });

  fastify.post('/refresh', async (request: FastifyRequest<{ Body: { refreshToken: string } }>, reply: FastifyReply) => {
    try {
      const decoded = fastify.jwt.verify(request.body.refreshToken) as any;
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

  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.userId },
      include: { store: true },
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
}

