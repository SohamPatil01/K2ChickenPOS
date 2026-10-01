import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';

const { userFindMany, shiftFindFirst, storeFindUnique, storeFindMany } = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  shiftFindFirst: vi.fn(),
  storeFindUnique: vi.fn(),
  storeFindMany: vi.fn(),
}));

vi.mock('@azela-pos/db', () => ({
  prisma: {
    user: { findMany: userFindMany },
    shift: { findFirst: shiftFindFirst },
    store: { findUnique: storeFindUnique, findMany: storeFindMany },
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
    storeFindUnique.mockReset();
    storeFindMany.mockReset();
    storeFindUnique.mockResolvedValue({ type: 'OWNER', parentOwnerStoreId: null });
    storeFindMany.mockResolvedValue([]);
  });

  it('returns INVALID_FORMAT for short pin', async () => {
    await expect(resolveUserByDayPin('store-1', '12')).resolves.toEqual({
      user: null,
      reason: 'INVALID_FORMAT',
    });
    expect(userFindMany).not.toHaveBeenCalled();
  });

  it('returns matching user', async () => {
    const hash = await bcrypt.hash('1234', 4);
    userFindMany.mockResolvedValue([
      { id: 'u1', name: 'Asha', role: 'CASHIER', dayPinHash: hash },
    ]);
    await expect(resolveUserByDayPin('store-1', '1234')).resolves.toEqual({
      user: { id: 'u1', name: 'Asha', role: 'CASHIER' },
      reason: null,
    });
  });

  it('returns INVALID_DAY_PIN for wrong pin', async () => {
    const hash = await bcrypt.hash('1234', 4);
    userFindMany.mockResolvedValue([
      { id: 'u1', name: 'Asha', role: 'CASHIER', dayPinHash: hash },
    ]);
    await expect(resolveUserByDayPin('store-1', '9999')).resolves.toEqual({
      user: null,
      reason: 'INVALID_DAY_PIN',
    });
  });

  it('returns NO_DAY_PIN_CONFIGURED when nobody has a pin', async () => {
    userFindMany.mockResolvedValue([]);
    await expect(resolveUserByDayPin('store-1', '1234')).resolves.toEqual({
      user: null,
      reason: 'NO_DAY_PIN_CONFIGURED',
    });
  });

  it('includes parent owner store when resolving from franchise', async () => {
    storeFindUnique.mockResolvedValue({
      type: 'FRANCHISE',
      parentOwnerStoreId: 'owner-1',
    });
    userFindMany.mockResolvedValue([]);
    await resolveUserByDayPin('franchise-1', '1234');
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storeId: { in: expect.arrayContaining(['franchise-1', 'owner-1']) },
        }),
      })
    );
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
