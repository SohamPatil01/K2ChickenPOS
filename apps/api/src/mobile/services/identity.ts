import { prisma, type Prisma } from '@azela-pos/db';
import { posPhoneVariants } from '../domain/phone.js';
import { ensureReferralCode, linkReferredByCode } from '../../lib/referral.js';
import { getRewardsConfig } from '../domain/rewards.js';
import { HttpError } from '../errors.js';

type Tx = Prisma.TransactionClient;

/** Owner store used for new customer rows (mirrors portal + pre-order behaviour). */
export async function resolveDefaultOwnerStoreId(db: Tx | typeof prisma = prisma): Promise<string | null> {
  const owner = await db.store.findFirst({ where: { type: 'OWNER' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  return owner?.id ?? null;
}

export async function resolveOwnerStoreIdFor(storeId: string): Promise<string | null> {
  const s = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, type: true, parentOwnerStoreId: true } });
  if (!s) return null;
  return s.type === 'OWNER' ? s.id : s.parentOwnerStoreId;
}

/**
 * Called only after the phone was PROVEN (OTP) or an existing portal PIN was verified.
 * Links every POS customer row with exactly that phone. Never links on name similarity.
 */
export async function establishIdentity(args: {
  phone: string;
  method: 'OTP' | 'PORTAL_PIN';
  name?: string | null;
  referralCode?: string | null;
}): Promise<{ identityId: string; isNewCustomer: boolean }> {
  const variants = posPhoneVariants(args.phone);
  const result = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const identity = await tx.customerIdentity.upsert({
      where: { phone: args.phone },
      create: { phone: args.phone, verifiedAt: now, verificationMethod: args.method },
      update: { verifiedAt: now, verificationMethod: args.method },
    });
    const customers = await tx.customer.findMany({
      where: { phone: { in: variants } },
      select: { id: true, storeId: true, loyaltyPoints: true, portalPinHash: true, updatedAt: true },
    });
    if (customers.length) {
      await tx.customerIdentityLink.createMany({
        data: customers.map((c) => ({ identityId: identity.id, customerId: c.id, linkedVia: 'VERIFIED_PHONE' })),
        skipDuplicates: true,
      });
    }
    let primaryId = identity.primaryCustomerId && customers.some((c) => c.id === identity.primaryCustomerId)
      ? identity.primaryCustomerId
      : null;
    let isNewCustomer = false;
    if (!primaryId) {
      const ownerStoreId = await resolveDefaultOwnerStoreId(tx);
      const ranked = [...customers].sort(
        (a, b) =>
          Number(b.storeId === ownerStoreId) - Number(a.storeId === ownerStoreId) ||
          Number(!!b.portalPinHash) - Number(!!a.portalPinHash) ||
          (b.loyaltyPoints || 0) - (a.loyaltyPoints || 0)
      );
      if (ranked[0]) primaryId = ranked[0].id;
      else {
        if (!ownerStoreId) throw new HttpError(503, 'STORE_NOT_CONFIGURED', 'Store is not configured');
        const created = await tx.customer.create({
          data: { storeId: ownerStoreId, name: args.name?.trim() || 'K2 Customer', phone: args.phone },
          select: { id: true },
        });
        await tx.customerIdentityLink.create({
          data: { identityId: identity.id, customerId: created.id, linkedVia: 'VERIFIED_PHONE' },
        });
        primaryId = created.id;
        isNewCustomer = true;
      }
      await tx.customerIdentity.update({ where: { id: identity.id }, data: { primaryCustomerId: primaryId } });
    }
    return { identityId: identity.id, primaryId: primaryId as string, isNewCustomer };
  });

  await ensureReferralCode(prisma, result.primaryId);
  if (args.referralCode && result.isNewCustomer) {
    await applyReferralCode(result.identityId, result.primaryId, args.referralCode);
  }
  return { identityId: result.identityId, isNewCustomer: result.isNewCustomer };
}

/**
 * Referral attribution with anti-abuse checks on top of the POS rules in lib/referral.ts
 * (self-referral, same phone, one referrer per customer, bonus after first settled bill only).
 */
export async function applyReferralCode(identityId: string, customerId: string, code: string): Promise<{ linked: boolean; reason?: string }> {
  const ids = await linkedCustomerIds(identityId);
  const paid = await prisma.sale.count({ where: { customerId: { in: ids }, status: 'PAID' } });
  if (paid > 0) return { linked: false, reason: 'EXISTING_CUSTOMER' };
  const referrer = await prisma.customer.findFirst({
    where: { referralCode: String(code).trim().toUpperCase() },
    select: { id: true },
  });
  if (!referrer) return { linked: false, reason: 'INVALID_CODE' };
  if (ids.includes(referrer.id)) return { linked: false, reason: 'SELF_REFERRAL' };
  const since = new Date(Date.now() - 30 * 86_400_000);
  const recent = await prisma.customer.count({ where: { referredByCustomerId: referrer.id, createdAt: { gte: since } } });
  if (recent >= getRewardsConfig().referralMonthlyCap) return { linked: false, reason: 'REFERRER_CAP_REACHED' };
  const linked = await linkReferredByCode(prisma, customerId, code);
  return linked ? { linked: true } : { linked: false, reason: 'ALREADY_REFERRED' };
}

export async function linkedCustomerIds(identityId: string): Promise<string[]> {
  const links = await prisma.customerIdentityLink.findMany({ where: { identityId }, select: { customerId: true } });
  return links.map((l) => l.customerId);
}

export type IdentityContext = {
  identityId: string;
  phone: string;
  primaryCustomerId: string;
  customerIds: string[];
};

export async function loadIdentity(identityId: string): Promise<IdentityContext> {
  const identity = await prisma.customerIdentity.findUnique({ where: { id: identityId } });
  if (!identity || !identity.primaryCustomerId) throw new HttpError(401, 'UNAUTHORIZED', 'Unauthorized');
  const customerIds = await linkedCustomerIds(identityId);
  return { identityId, phone: identity.phone, primaryCustomerId: identity.primaryCustomerId, customerIds };
}
