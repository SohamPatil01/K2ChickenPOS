import { beforeEach, describe, expect, it, vi } from 'vitest';

const { storeFindUnique } = vi.hoisted(() => ({
  storeFindUnique: vi.fn(),
}));

vi.mock('@azela-pos/db', () => ({
  prisma: {
    store: {
      findUnique: storeFindUnique,
    },
  },
}));

import { canAccessCustomerStore } from './storeScope.js';

describe('canAccessCustomerStore', () => {
  beforeEach(() => {
    storeFindUnique.mockReset();
  });

  it('allows the user store', async () => {
    await expect(canAccessCustomerStore('store-1', 'CASHIER', 'store-1')).resolves.toBe(true);
    expect(storeFindUnique).not.toHaveBeenCalled();
  });

  it('allows a franchise user to access its owner customers', async () => {
    storeFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === 'franchise-1'
        ? { type: 'FRANCHISE', parentOwnerStoreId: 'owner-1' }
        : { type: 'OWNER', parentOwnerStoreId: null }
    );

    await expect(
      canAccessCustomerStore('franchise-1', 'CASHIER', 'owner-1')
    ).resolves.toBe(true);
  });

  it('allows an owner to access a child franchise customer', async () => {
    storeFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === 'owner-1'
        ? { type: 'OWNER', parentOwnerStoreId: null }
        : { type: 'FRANCHISE', parentOwnerStoreId: 'owner-1' }
    );

    await expect(
      canAccessCustomerStore('owner-1', 'OWNER', 'franchise-1')
    ).resolves.toBe(true);
  });

  it('rejects an unrelated customer store', async () => {
    storeFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === 'store-1'
        ? { type: 'OWNER', parentOwnerStoreId: null }
        : { type: 'OWNER', parentOwnerStoreId: null }
    );

    await expect(
      canAccessCustomerStore('store-1', 'MANAGER', 'other-store')
    ).resolves.toBe(false);
  });
});
