import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';

const { userFindMany, shiftFindFirst } = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  shiftFindFirst: vi.fn(),
}));

vi.mock('@azela-pos/db', () => ({
  prisma: {
    user: { findMany: userFindMany },
    shift: { findFirst: shiftFindFirst },
  },
}));

import {
  DAY_IN_REQUIRED,
  requireOpenShiftId,
  resolveUserByDayPin,
} from './shiftService.js';

describe('resolveUserByDayPin', () => {
  beforeEach(() => {
    userFindMany.mockReset();
  });

  it('returns null for invalid pin format', async () => {
    await expect(resolveUserByDayPin('store-1', '12')).resolves.toBeNull();
    expect(userFindMany).not.toHaveBeenCalled();
  });

  it('returns matching user', async () => {
    const hash = await bcrypt.hash('1234', 4);
    userFindMany.mockResolvedValue([
      { id: 'u1', name: 'Asha', role: 'CASHIER', dayPinHash: hash },
    ]);
    await expect(resolveUserByDayPin('store-1', '1234')).resolves.toEqual({
      id: 'u1',
      name: 'Asha',
      role: 'CASHIER',
    });
  });

  it('returns null for wrong pin', async () => {
    const hash = await bcrypt.hash('1234', 4);
    userFindMany.mockResolvedValue([
      { id: 'u1', name: 'Asha', role: 'CASHIER', dayPinHash: hash },
    ]);
    await expect(resolveUserByDayPin('store-1', '9999')).resolves.toBeNull();
  });
});

describe('requireOpenShiftId', () => {
  beforeEach(() => {
    shiftFindFirst.mockReset();
  });

  it('returns shift id when open', async () => {
    shiftFindFirst.mockResolvedValue({ id: 'shift-1' });
    await expect(requireOpenShiftId('store-1')).resolves.toBe('shift-1');
  });

  it('returns null when closed / missing', async () => {
    shiftFindFirst.mockResolvedValue(null);
    await expect(requireOpenShiftId('store-1')).resolves.toBeNull();
  });
});

describe('DAY_IN_REQUIRED constant', () => {
  it('is stable for clients', () => {
    expect(DAY_IN_REQUIRED).toBe('DAY_IN_REQUIRED');
  });
});
