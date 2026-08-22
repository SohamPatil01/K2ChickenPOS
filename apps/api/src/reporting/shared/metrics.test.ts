import { describe, it, expect } from 'vitest';
import {
  round2,
  pct,
  deltaPct,
  grossProfit,
  grossMarginPct,
  netProfit,
  budgetVariancePct,
  weightedAvgCost,
  inventoryTurnover,
  wastagePct,
  retentionRate,
  redemptionRate,
  referralConversion,
  contributionPct,
  aov,
} from './metrics.js';

describe('reporting metrics', () => {
  it('round2 rounds to 2 decimals', () => {
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
  });

  it('pct calculates percentage', () => {
    expect(pct(25, 100)).toBe(25);
    expect(pct(0, 0)).toBe(0);
  });

  it('deltaPct handles prior zero', () => {
    expect(deltaPct(100, 0)).toBe(100);
    expect(deltaPct(0, 0)).toBe(null);
    expect(deltaPct(110, 100)).toBe(10);
  });

  it('gross profit and margin', () => {
    expect(grossProfit(1000, 600)).toBe(400);
    expect(grossMarginPct(1000, 600)).toBe(40);
  });

  it('net profit subtracts purchases and expenses', () => {
    expect(netProfit(10000, 4000, 1000)).toBe(5000);
  });

  it('budget variance', () => {
    expect(budgetVariancePct(120, 100)).toBe(20);
  });

  it('weighted average cost', () => {
    expect(weightedAvgCost([
      { rate: 100, qty: 2 },
      { rate: 200, qty: 1 },
    ])).toBe(133.33);
  });

  it('inventory turnover null when missing data', () => {
    expect(inventoryTurnover(0, 100)).toBe(null);
    expect(inventoryTurnover(500, 250)).toBe(2);
  });

  it('wastage pct', () => {
    expect(wastagePct(10, 90)).toBe(10);
  });

  it('retention and redemption rates', () => {
    expect(retentionRate(30, 100)).toBe(30);
    expect(redemptionRate(20, 100)).toBe(20);
  });

  it('referral conversion', () => {
    expect(referralConversion(5, 20)).toBe(25);
  });

  it('contribution pct', () => {
    expect(contributionPct(300, 1000)).toBe(30);
  });

  it('aov', () => {
    expect(aov(1000, 10)).toBe(100);
    expect(aov(0, 0)).toBe(0);
  });
});
