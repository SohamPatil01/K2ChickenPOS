import type { Prisma, PrismaClient } from '@azela-pos/db';
import { CUSTOMER_AREA_LABEL } from '../utils/customerArea.js';

const PLACEHOLDER = '—';
export const PROFILE_REWARD_PERCENT = 10;

export type ProfileRewardSource = 'portal' | 'pos' | 'display';
export type ProfileRewardStatus = 'PENDING' | 'REDEEMED';

type DbClient = Pick<
  PrismaClient | Prisma.TransactionClient,
  'customer' | 'customerAddress'
>;

type AddressLike = {
  label?: string | null;
  line1?: string | null;
  city?: string | null;
};

function isRealText(value: unknown): boolean {
  const s = String(value || '').trim();
  return s.length > 0 && s !== PLACEHOLDER;
}

export function isFullDeliveryAddress(address: AddressLike | null | undefined): boolean {
  if (!address) return false;
  if (String(address.label || '') === CUSTOMER_AREA_LABEL) return false;
  return isRealText(address.line1) && isRealText(address.city);
}

export async function customerHasFullAddress(
  db: DbClient,
  customerId: string
): Promise<boolean> {
  const address = await db.customerAddress.findFirst({
    where: {
      customerId,
      label: { not: CUSTOMER_AREA_LABEL },
    },
    select: { id: true, label: true, line1: true, city: true },
    orderBy: { updatedAt: 'desc' },
  });
  return isFullDeliveryAddress(address);
}

export async function evaluateProfileCompletion(
  db: DbClient,
  customerId: string
): Promise<{ isComplete: boolean; missing: Array<'name' | 'address'> }> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { name: true },
  });
  const missing: Array<'name' | 'address'> = [];
  if (!isRealText(customer?.name)) missing.push('name');
  if (!(await customerHasFullAddress(db, customerId))) missing.push('address');
  return { isComplete: missing.length === 0, missing };
}

export async function grantProfileRewardIfEligible(
  db: DbClient,
  customerId: string,
  source: ProfileRewardSource
): Promise<boolean> {
  const status = await db.customer.findUnique({
    where: { id: customerId },
    select: { id: true, profileRewardStatus: true },
  });
  if (!status || status.profileRewardStatus) return false;

  const completion = await evaluateProfileCompletion(db, customerId);
  if (!completion.isComplete) return false;

  const updated = await db.customer.updateMany({
    where: {
      id: customerId,
      profileRewardStatus: null,
    },
    data: {
      profileCompletedAt: new Date(),
      profileRewardPercent: PROFILE_REWARD_PERCENT,
      profileRewardStatus: 'PENDING',
      profileRewardSource: source,
    },
  });
  return updated.count > 0;
}

export async function redeemProfileReward(
  db: DbClient,
  customerId: string
): Promise<boolean> {
  const updated = await db.customer.updateMany({
    where: {
      id: customerId,
      profileRewardStatus: 'PENDING',
    },
    data: {
      profileRewardStatus: 'REDEEMED',
    },
  });
  return updated.count > 0;
}

export function getProfileRewardState(customer: {
  profileRewardPercent?: number | null;
  profileRewardStatus?: string | null;
  profileRewardSource?: string | null;
  profileCompletedAt?: Date | null;
}) {
  const status =
    customer.profileRewardStatus === 'PENDING' || customer.profileRewardStatus === 'REDEEMED'
      ? (customer.profileRewardStatus as ProfileRewardStatus)
      : null;
  return {
    percent: Number(customer.profileRewardPercent) || PROFILE_REWARD_PERCENT,
    status,
    source: customer.profileRewardSource || null,
    completedAt: customer.profileCompletedAt || null,
    pending: status === 'PENDING',
    redeemed: status === 'REDEEMED',
  };
}
