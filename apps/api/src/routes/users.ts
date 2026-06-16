// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';
import { canAccessStoreResource, resolveStoreIdFilter } from '../utils/storeScope.js';

const createUserSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  email: z.string().email().optional().or(z.literal('')),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER', 'DRIVER']),
  password: z.string().min(6),
  isActive: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional().or(z.literal('')),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER', 'DRIVER']).optional(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional(),
});

export async function userRoutes(fastify: FastifyInstance) {
  // Get all users (staff) - Only OWNER can access
  fastify.get('/', { preHandler: [fastify.authenticate, requireRole('OWNER')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request) as any;
    const storeFilter = await resolveStoreIdFilter(user.storeId, user.role);

    const users = await prisma.user.findMany({
      where: { storeId: storeFilter },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users;
  });

  // Create new user (staff) - Only OWNER can create
  fastify.post('/', { preHandler: [fastify.authenticate, requireRole('OWNER')] }, async (request: any, reply: FastifyReply) => {
    // Get default store (owner store)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' }, select: { id: true, name: true, type: true, parentOwnerStoreId: true } });
    const storeId = store?.id || (getUser(request) as any).storeId;
    const data = createUserSchema.parse(request.body as any);

    // Check if phone already exists
    const existingUser = await prisma.user.findUnique({
      where: { phone: data.phone },
    });

    if (existingUser) {
      reply.code(400).send({ error: 'User with this phone number already exists' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        storeId,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        role: data.role,
        passwordHash,
        isActive: data.isActive ?? true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  });

  // Update user (staff) - Only OWNER can update
  fastify.put('/:id', { preHandler: [fastify.authenticate, requireRole('OWNER')] }, async (request: any, reply: FastifyReply) => {
    const user = getUser(request) as any;
    const storeId = user.storeId;
    const { id } = (request.params as any);
    const data = updateUserSchema.parse(request.body as any);

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      reply.code(404).send({ error: 'User not found' });
      return;
    }

    if (!(await canAccessStoreResource(storeId, user.role, existingUser.storeId))) {
      reply.code(403).send({ error: 'Access denied' });
      return;
    }

    // If phone is being updated, check if it's already taken
    if (data.phone && data.phone !== existingUser.phone) {
      const phoneExists = await prisma.user.findUnique({
        where: { phone: data.phone },
      });

      if (phoneExists) {
        reply.code(400).send({ error: 'Phone number already in use' });
        return;
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.phone) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.role) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  });

  // Delete user (staff) - Only OWNER can delete
  fastify.delete('/:id', { preHandler: [fastify.authenticate, requireRole('OWNER')] }, async (request: any, reply: FastifyReply) => {
    const user = getUser(request) as any;
    const storeId = user.storeId;
    const { id } = (request.params as any);

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      reply.code(404).send({ error: 'User not found' });
      return;
    }

    if (!(await canAccessStoreResource(storeId, user.role, existingUser.storeId))) {
      reply.code(403).send({ error: 'Access denied' });
      return;
    }

    if (existingUser.id === user.userId) {
      reply.code(400).send({ error: 'Cannot delete your own account' });
      return;
    }

    await prisma.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  });

  // Get single user - Only OWNER can access
  fastify.get('/:id', { preHandler: [fastify.authenticate, requireRole('OWNER')] }, async (request: any, reply: FastifyReply) => {
    const user = getUser(request) as any;
    const storeId = user.storeId;
    const { id } = (request.params as any);

    const staff = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        storeId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!staff) {
      reply.code(404).send({ error: 'User not found' });
      return;
    }

    if (!(await canAccessStoreResource(storeId, user.role, staff.storeId))) {
      reply.code(403).send({ error: 'Access denied' });
      return;
    }

    const { storeId: _, ...userResponse } = staff;
    return userResponse;
  });
}

