import { LOYALTY_EARN_RATE, LOYALTY_POINT_VALUE, REFERRAL_BONUS_POINTS, computeLoyaltyEarnPoints } from '@azela-pos/shared';

/**
 * K2 Rewards rules as seen by the app.
 *
 * EARNING is owned by the POS (packages/shared computeLoyaltyEarnPoints, applied on sale
 * settlement in lib/loyalty.ts). The app never credits earn points itself — it only
 * displays what the POS ledger says. The pilot proposal "1 pt per ₹100" differs from the
 * live POS rate (LOYALTY_EARN_RATE); changing it is a commercial decision for the owner.
 *
 * REDEMPTION limits for app orders are configurable here (env) because they are new.
 */
export type RewardsConfig = {
  earnRate: number; // points per ₹1 of bill (POS)
  pointValuePaise: number; // paise per point (POS)
  maxRedeemPercent: number; // of eligible merchandise subtotal
  minPointsToRedeem: number;
  referralBonusPoints: number; // POS
  referralMonthlyCap: number;
  milestoneEveryOrders: number; // 0 = disabled
  milestoneBonusPoints: number;
  policyVersion: string;
};

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export function getRewardsConfig(): RewardsConfig {
  return {
    earnRate: LOYALTY_EARN_RATE,
    pointValuePaise: Math.round(LOYALTY_POINT_VALUE * 100),
    maxRedeemPercent: envInt('MOBILE_REDEEM_MAX_PERCENT', 5),
    minPointsToRedeem: envInt('MOBILE_REDEEM_MIN_POINTS', 50),
    referralBonusPoints: REFERRAL_BONUS_POINTS,
    referralMonthlyCap: envInt('MOBILE_REFERRAL_MONTHLY_CAP', 10),
    milestoneEveryOrders: envInt('MOBILE_MILESTONE_EVERY_ORDERS', 0),
    milestoneBonusPoints: envInt('MOBILE_MILESTONE_BONUS_POINTS', 0),
    policyVersion: process.env.MOBILE_REWARDS_POLICY_VERSION || 'rewards-2026-11-pilot',
  };
}

export function estimateEarnPoints(grandTotalPaise: number): number {
  return computeLoyaltyEarnPoints(grandTotalPaise / 100);
}

/**
 * Points that may be applied to a basket. Never exceeds available balance, the % cap,
 * or the merchandise value. Returns 0 below the minimum threshold.
 */
export function maxRedeemablePoints(args: {
  availablePoints: number;
  merchandisePaise: number;
  config: RewardsConfig;
}): number {
  const { availablePoints, merchandisePaise, config } = args;
  const available = Math.max(0, Math.floor(availablePoints));
  if (available < config.minPointsToRedeem || config.pointValuePaise <= 0) return 0;
  const capPaise = Math.floor((Math.max(0, merchandisePaise) * config.maxRedeemPercent) / 100);
  const capPoints = Math.floor(capPaise / config.pointValuePaise);
  return Math.max(0, Math.min(available, capPoints));
}

export function milestoneProgress(qualifyingOrders: number, config: RewardsConfig) {
  if (!config.milestoneEveryOrders || !config.milestoneBonusPoints) return null;
  const every = config.milestoneEveryOrders;
  const into = qualifyingOrders % every;
  return {
    every,
    bonusPoints: config.milestoneBonusPoints,
    completedInCycle: into,
    remaining: every - into,
  };
}
