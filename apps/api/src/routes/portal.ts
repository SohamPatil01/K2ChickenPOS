// @ts-nocheck
import { FastifyInstance, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '@azela-pos/db';
import {
  ensureReferralCode,
  linkReferredByCode,
} from '../lib/referral.js';

const PIN_MIN = 4;
const PIN_MAX = 6;

function normalizePhone(raw: unknown): string {
  return String(raw || '').replace(/\D/g, '');
}

function validatePin(pin: unknown): string | null {
  const p = String(pin || '').trim();
  if (!/^\d+$/.test(p) || p.length < PIN_MIN || p.length > PIN_MAX) {
    return null;
  }
  return p;
}

async function resolvePortalStoreId(): Promise<string | null> {
  const owner = await prisma.store.findFirst({
    where: { type: 'OWNER' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return owner?.id || null;
}

/** Find customer by phone across owner + franchise stores; prefer one with a portal PIN, else most recently updated. */
async function findCustomersByPhone(phone: string) {
  return prisma.customer.findMany({
    where: { phone },
    orderBy: { updatedAt: 'desc' },
  });
}

function pickCustomerForPortal(customers: Awaited<ReturnType<typeof findCustomersByPhone>>) {
  if (!customers.length) return null;
  const withPin = customers.find((c) => c.portalPinHash);
  if (withPin) return withPin;
  return [...customers].sort((a, b) => (b.loyaltyPoints || 0) - (a.loyaltyPoints || 0))[0];
}

function customerPublic(c: {
  id: string;
  name: string;
  phone: string;
  loyaltyPoints: number;
  loyaltyTier: string;
  referralCode?: string | null;
}) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    loyaltyPoints: Math.round(c.loyaltyPoints || 0),
    loyaltyTier: c.loyaltyTier || 'BRONZE',
    referralCode: c.referralCode || null,
  };
}

async function withReferralCode(customer: {
  id: string;
  name: string;
  phone: string;
  loyaltyPoints: number;
  loyaltyTier: string;
  referralCode?: string | null;
}) {
  const code = customer.referralCode || (await ensureReferralCode(prisma, customer.id));
  return customerPublic({ ...customer, referralCode: code });
}

export async function authenticatePortalCustomer(request: any, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
    const payload = request.user as any;
    if (payload?.tokenType !== 'CUSTOMER' || !payload?.customerId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    request.portalCustomer = {
      customerId: payload.customerId,
      storeId: payload.storeId,
      phone: payload.phone,
    };
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function portalRoutes(fastify: FastifyInstance) {
  const signCustomerToken = (customer: { id: string; storeId: string; phone: string }) =>
    fastify.jwt.sign(
      {
        tokenType: 'CUSTOMER',
        customerId: customer.id,
        storeId: customer.storeId,
        phone: customer.phone,
      },
      { expiresIn: process.env.PORTAL_JWT_EXPIRES_IN || '7d' }
    );

  const portalAuthLimit = {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
      },
    },
  };

  fastify.post('/register', portalAuthLimit, async (request: any, reply: FastifyReply) => {
    try {
      const body = (request.body as any) || {};
      const name = String(body.name || '').trim();
      const phone = normalizePhone(body.phone);
      const pin = validatePin(body.pin);
      const referralCodeIn = body.referralCode ? String(body.referralCode).trim() : '';

      if (name.length < 2) {
        return reply.code(400).send({ error: 'Name is required (at least 2 characters)' });
      }
      if (phone.length < 10) {
        return reply.code(400).send({ error: 'Enter a valid 10-digit phone number' });
      }
      if (!pin) {
        return reply.code(400).send({ error: `PIN must be ${PIN_MIN}-${PIN_MAX} digits` });
      }

      const existing = pickCustomerForPortal(await findCustomersByPhone(phone));
      if (existing?.portalPinHash) {
        return reply.code(409).send({
          error: 'This phone is already registered. Please log in.',
          code: 'ALREADY_REGISTERED',
        });
      }

      const pinHash = await bcrypt.hash(pin, 10);
      const now = new Date();

      let customer;
      if (existing) {
        customer = await prisma.customer.update({
          where: { id: existing.id },
          data: {
            portalPinHash: pinHash,
            portalRegisteredAt: now,
            name: existing.name || name,
          },
        });
      } else {
        const storeId = await resolvePortalStoreId();
        if (!storeId) {
          return reply.code(503).send({ error: 'Store is not configured' });
        }
        customer = await prisma.customer.create({
          data: {
            storeId,
            name,
            phone,
            loyaltyPoints: 0,
            loyaltyTier: 'BRONZE',
            totalSpent: 0,
            portalPinHash: pinHash,
            portalRegisteredAt: now,
          },
        });
      }

      if (referralCodeIn) {
        await linkReferredByCode(prisma, customer.id, referralCodeIn);
      }
      await ensureReferralCode(prisma, customer.id);

      const accessToken = signCustomerToken(customer);
      return {
        accessToken,
        customer: await withReferralCode(customer),
      };
    } catch (error: any) {
      console.error('[Portal] register failed:', error);
      return reply.code(500).send({ error: 'Registration failed', details: error?.message });
    }
  });

  fastify.post('/claim', portalAuthLimit, async (request: any, reply: FastifyReply) => {
    try {
      const body = (request.body as any) || {};
      const phone = normalizePhone(body.phone);
      const pin = validatePin(body.pin);

      if (phone.length < 10) {
        return reply.code(400).send({ error: 'Enter a valid 10-digit phone number' });
      }
      if (!pin) {
        return reply.code(400).send({ error: `PIN must be ${PIN_MIN}-${PIN_MAX} digits` });
      }

      const customer = pickCustomerForPortal(await findCustomersByPhone(phone));
      if (!customer) {
        return reply.code(404).send({
          error: 'No account found for this number. Please register first.',
          code: 'NOT_FOUND',
        });
      }
      if (customer.portalPinHash) {
        return reply.code(409).send({
          error: 'This phone already has a PIN. Please log in.',
          code: 'ALREADY_CLAIMED',
        });
      }

      const pinHash = await bcrypt.hash(pin, 10);
      const updated = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          portalPinHash: pinHash,
          portalRegisteredAt: new Date(),
        },
      });

      await ensureReferralCode(prisma, updated.id);

      const accessToken = signCustomerToken(updated);
      return {
        accessToken,
        customer: await withReferralCode(updated),
      };
    } catch (error: any) {
      console.error('[Portal] claim failed:', error);
      return reply.code(500).send({ error: 'Could not set PIN', details: error?.message });
    }
  });

  fastify.post('/login', portalAuthLimit, async (request: any, reply: FastifyReply) => {
    try {
      const body = (request.body as any) || {};
      const phone = normalizePhone(body.phone);
      const pin = validatePin(body.pin);

      if (phone.length < 10) {
        return reply.code(400).send({ error: 'Enter a valid 10-digit phone number' });
      }
      if (!pin) {
        return reply.code(400).send({ error: `PIN must be ${PIN_MIN}-${PIN_MAX} digits` });
      }

      const customer = pickCustomerForPortal(await findCustomersByPhone(phone));
      if (!customer) {
        return reply.code(404).send({
          error: 'No account found. Please register.',
          code: 'NOT_FOUND',
        });
      }
      if (!customer.portalPinHash) {
        return reply.code(404).send({
          error: 'Set a PIN first (register or claim this number).',
          code: 'NO_PIN',
        });
      }

      const ok = await bcrypt.compare(pin, customer.portalPinHash);
      if (!ok) {
        return reply.code(401).send({ error: 'Incorrect PIN' });
      }

      await ensureReferralCode(prisma, customer.id);

      const accessToken = signCustomerToken(customer);
      return {
        accessToken,
        customer: await withReferralCode(customer),
      };
    } catch (error: any) {
      console.error('[Portal] login failed:', error);
      return reply.code(500).send({ error: 'Login failed', details: error?.message });
    }
  });

  fastify.post('/lookup', portalAuthLimit, async (request: any, reply: FastifyReply) => {
    try {
      const phone = normalizePhone((request.body as any)?.phone);
      if (phone.length < 10) {
        return reply.code(400).send({ error: 'Enter a valid 10-digit phone number' });
      }
      const customer = pickCustomerForPortal(await findCustomersByPhone(phone));
      if (!customer) {
        return { exists: false, hasPin: false };
      }
      return {
        exists: true,
        hasPin: Boolean(customer.portalPinHash),
        name: customer.name,
      };
    } catch (error: any) {
      console.error('[Portal] lookup failed:', error);
      return reply.code(500).send({ error: 'Lookup failed' });
    }
  });

  fastify.get('/me', { preHandler: [authenticatePortalCustomer] }, async (request: any, reply: FastifyReply) => {
    try {
      const { customerId } = request.portalCustomer;
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          name: true,
          phone: true,
          loyaltyPoints: true,
          loyaltyTier: true,
          referralCode: true,
        },
      });
      if (!customer) {
        return reply.code(404).send({ error: 'Customer not found' });
      }
      return { customer: await withReferralCode(customer) };
    } catch (error: any) {
      console.error('[Portal] me failed:', error);
      return reply.code(500).send({ error: 'Failed to load profile' });
    }
  });

  fastify.post(
    '/change-pin',
    { preHandler: [authenticatePortalCustomer], ...portalAuthLimit },
    async (request: any, reply: FastifyReply) => {
      try {
        const body = (request.body as any) || {};
        const currentPin = validatePin(body.currentPin);
        const newPin = validatePin(body.newPin);
        if (!currentPin || !newPin) {
          return reply.code(400).send({ error: `PIN must be ${PIN_MIN}-${PIN_MAX} digits` });
        }
        if (currentPin === newPin) {
          return reply.code(400).send({ error: 'New PIN must be different' });
        }

        const { customerId } = request.portalCustomer;
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { id: true, portalPinHash: true },
        });
        if (!customer?.portalPinHash) {
          return reply.code(400).send({ error: 'No PIN set on this account' });
        }

        const ok = await bcrypt.compare(currentPin, customer.portalPinHash);
        if (!ok) {
          return reply.code(401).send({ error: 'Current PIN is incorrect' });
        }

        const pinHash = await bcrypt.hash(newPin, 10);
        await prisma.customer.update({
          where: { id: customerId },
          data: { portalPinHash: pinHash },
        });

        return { ok: true };
      } catch (error: any) {
        console.error('[Portal] change-pin failed:', error);
        return reply.code(500).send({ error: 'Could not change PIN' });
      }
    }
  );
}
