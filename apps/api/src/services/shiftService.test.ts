import { describe, expect, it } from 'vitest';
import {
  expectedCashAtDayOut,
  hourInStoreTz,
  needsDayOutReminder,
  sumMovementTotals,
} from '../services/shiftService.js';

describe('sumMovementTotals', () => {
  it('sums IN and OUT separately', () => {
    expect(
      sumMovementTotals([
        { type: 'IN', amount: 100 },
        { type: 'OUT', amount: 40 },
        { type: 'OUT', amount: 10.5 },
        { type: 'IN', amount: 5 },
      ])
    ).toEqual({ cashIn: 105, cashOut: 50.5 });
  });

  it('handles empty list', () => {
    expect(sumMovementTotals([])).toEqual({ cashIn: 0, cashOut: 0 });
  });
});

describe('expectedCashAtDayOut', () => {
  it('opening + cash sales + in − out', () => {
    expect(expectedCashAtDayOut(1000, 500, 50, 200)).toBe(1350);
  });

  it('rounds to millis', () => {
    expect(expectedCashAtDayOut(100, 0.1, 0, 0)).toBe(100.1);
  });
});

describe('needsDayOutReminder', () => {
  it('false when day not open', () => {
    expect(needsDayOutReminder(false, new Date('2026-10-01T15:00:00+05:30'))).toBe(false);
  });

  it('true when open and after reminder hour IST', () => {
    // 21:00 IST
    expect(needsDayOutReminder(true, new Date('2026-10-01T21:00:00+05:30'), 20)).toBe(true);
  });

  it('false when open but before reminder hour', () => {
    expect(needsDayOutReminder(true, new Date('2026-10-01T10:00:00+05:30'), 20)).toBe(false);
  });
});

describe('hourInStoreTz', () => {
  it('returns IST hour', () => {
    // 14:30 IST
    expect(hourInStoreTz(new Date('2026-10-01T14:30:00+05:30'))).toBe(14);
  });
});
