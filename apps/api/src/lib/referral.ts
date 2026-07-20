// @ts-nocheck
import { REFERRAL_BONUS_POINTS } from '@azela-pos/shared';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeReferralPhone(raw: unknown): string {
  return String(raw || '').replace(/\D/g, '');
}

export function generateReferralCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** Ensure customer has a unique referralCode; returns the code. */
export async function ensureReferralCode(prisma: any, customerId: string): Promise<string> {
  const existing = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { referralCode: true },
  });
  if (existing?.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReferralCode();
    try {
      const updated = await prisma.customer.update({
        where: { id: customerId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      return updated.referralCode;
    } catch (err: any) {
      // Unique collision — retry
      if (err?.code === 'P2002') continue;
      throw err;
    }
  }
  throw new Error('Could not allocate referral code');
}

/** Resolve referrer by portal referral code. */
export async function findReferrerByCode(prisma: any, codeRaw: string) {
  const code = String(codeRaw || '')
    .trim()
    .toUpperCase();
  if (code.length < 4) return null;
  return prisma.customer.findFirst({
    where: { referralCode: code },
    select: { id: true, phone: true, storeId: true },
  });
}

/** Resolve referrer by phone (any store row for that phone; prefer highest points). */
export async function findReferrerByPhone(prisma: any, phoneRaw: string) {
  const phone = normalizeReferralPhone(phoneRaw);
  if (phone.length < 10) return null;
  const rows = await prisma.customer.findMany({
    where: { phone },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, phone: true, storeId: true, loyaltyPoints: true },
  });
  if (!rows.length) return null;
  return [...rows].sort((a, b) => (b.loyaltyPoints || 0) - (a.loyaltyPoints || 0))[0];
}

/**
 * Link customer → referrer once. No-op if already linked, self-referral, or referrer missing.
 */
export async function linkReferredBy(
  prisma: any,
  customerId: string,
  referrerId: string
): Promise<boolean> {
  if (!customerId || !referrerId || customerId === referrerId) return false;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, phone: true, referredByCustomerId: true },
  });
  if (!customer || customer.referredByCustomerId) return false;

  const referrer = await prisma.customer.findUnique({
    where: { id: referrerId },
    select: { id: true, phone: true },
  });
  if (!referrer) return false;
  if (customer.phone && referrer.phone && customer.phone === referrer.phone) return false;

  await prisma.customer.update({
    where: { id: customerId },
    data: { referredByCustomerId: referrerId },
  });
  return true;
}

export async function linkReferredByPhone(
  prisma: any,
  customerId: string,
  referredByPhone: string | undefined | null
): Promise<boolean> {
  if (!referredByPhone) return false;
  const referrer = await findReferrerByPhone(prisma, referredByPhone);
  if (!referrer) return false;
  return linkReferredBy(prisma, customerId, referrer.id);
}

export async function linkReferredByCode(
  prisma: any,
  customerId: string,
  referralCode: string | undefined | null
): Promise<boolean> {
  if (!referralCode) return false;
  const referrer = await findReferrerByCode(prisma, referralCode);
  if (!referrer) return false;
  return linkReferredBy(prisma, customerId, referrer.id);
}

/**
 * Award 50 pts to friend + referrer after friend's first settled bill.
 * Safe to call multiple times — guarded by referralBonusAwardedAt.
 */
export async function maybeAwardReferralBonus(
  prisma: any,
  opts: { customerId: string; storeId: string; saleId: string; userId?: string | null }
): Promise<void> {
  const { customerId, storeId, saleId, userId } = opts;
  const bonus = REFERRAL_BONUS_POINTS;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      loyaltyPoints: true,
      referredByCustomerId: true,
      referralBonusAwardedAt: true,
    },
  });

  if (!customer?.referredByCustomerId || customer.referralBonusAwardedAt) return;

  const priorPaid = await prisma.sale.count({
    where: {
      customerId,
      status: 'PAID',
      id: { not: saleId },
    },
  });
  if (priorPaid > 0) return;

  const referrer = await prisma.customer.findUnique({
    where: { id: customer.referredByCustomerId },
    select: { id: true, loyaltyPoints: true, storeId: true },
  });
  if (!referrer) return;

  const now = new Date();

  await prisma.$transaction(async (tx: any) => {
    const fresh = await tx.customer.findUnique({
      where: { id: customerId },
      select: { referralBonusAwardedAt: true, referredByCustomerId: true, loyaltyPoints: true },
    });
    if (!fresh?.referredByCustomerId || fresh.referralBonusAwardedAt) return;

    const refFresh = await tx.customer.findUnique({
      where: { id: fresh.referredByCustomerId },
      select: { id: true, loyaltyPoints: true, storeId: true },
    });
    if (!refFresh) return;

    const friendNext = Math.round((fresh.loyaltyPoints || 0) + bonus);
    const referrerNext = Math.round((refFresh.loyaltyPoints || 0) + bonus);

    await tx.customer.update({
      where: { id: customerId },
      data: {
        loyaltyPoints: friendNext,
        referralBonusAwardedAt: now,
      },
    });
    await tx.customer.update({
      where: { id: refFresh.id },
      data: { loyaltyPoints: referrerNext },
    });

    await tx.loyaltyTransaction.create({
      data: {
        customerId,
        storeId,
        type: 'REFERRAL',
        points: bonus,
        balance: friendNext,
        description: `Referral bonus (+${bonus}) — first purchase`,
        saleId,
        createdBy: userId || null,
      },
    });
    await tx.loyaltyTransaction.create({
      data: {
        customerId: refFresh.id,
        storeId: refFresh.storeId || storeId,
        type: 'REFERRAL',
        points: bonus,
        balance: referrerNext,
        description: `Referral bonus (+${bonus}) — friend first purchase`,
        saleId,
        createdBy: userId || null,
      },
    });
  });
}
