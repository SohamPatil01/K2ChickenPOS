import { describe, expect, it, vi } from 'vitest';
import {
  asPreOrderClaimError,
  completePreOrderClaimForSale,
  extractPreOrderIdsFromSaleInput,
  lockAndVerifyPreOrdersForSale,
  PreOrderClaimError,
  releasePreOrdersOnSaleVoid,
} from './preOrderClaim.js';

function makeFakeTx(opts: {
  preOrders: Array<{
    id: string;
    storeId: string;
    trackingCode: string;
    status: string;
    saleId: string | null;
  }>;
  sales?: Record<string, { id: string; saleNo: string; status: string }>;
}) {
  const state = {
    preOrders: opts.preOrders.map((p) => ({ ...p })),
    events: [] as any[],
  };
  const sales = opts.sales || {};

  const tx = {
    $queryRaw: vi.fn(async () => state.preOrders),
    sale: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => sales[where.id] ?? null),
    },
    preOrder: {
      findMany: vi.fn(async ({ where }: any) =>
        state.preOrders.filter(
          (p) =>
            (!where?.saleId || p.saleId === where.saleId) &&
            (!where?.status || p.status === where.status)
        )
      ),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.preOrders.find((p) => p.id === where.id);
        if (!row) throw new Error('missing');
        Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const p of state.preOrders) {
          if (
            p.id === where.id &&
            p.saleId === where.saleId &&
            p.status === where.status
          ) {
            Object.assign(p, data);
            count++;
          }
        }
        return { count };
      }),
    },
    preOrderEvent: {
      create: vi.fn(async ({ data }: any) => {
        state.events.push(data);
        return data;
      }),
    },
  };

  return { tx, state };
}

describe('preOrderClaim', () => {
  it('extracts and deduplicates preOrderIds from both payload and item metaJson in sorted order', () => {
    const ids = extractPreOrderIdsFromSaleInput({
      preOrderIds: ['po_b', ' po_a ', ''],
      items: [
        { metaJson: { preOrderId: 'po_a' } },
        { metaJson: { preOrderId: 'po_c' } },
        { metaJson: {} },
      ],
    });
    expect(ids).toEqual(['po_a', 'po_b', 'po_c']);
  });

  it('claims an open pre-order once and blocks any second Pay attempt (same time or later)', async () => {
    const sales: Record<string, { id: string; saleNo: string; status: string }> = {};
    const { tx, state } = makeFakeTx({
      preOrders: [
        {
          id: 'po_1',
          storeId: 'store_1',
          trackingCode: '9ERSHE',
          status: 'CONFIRMED',
          saleId: null,
        },
      ],
      sales,
    });

    // Cashier 1 locks & claims
    await lockAndVerifyPreOrdersForSale(tx as any, {
      preOrderIds: ['po_1'],
      storeId: 'store_1',
    });
    sales['sale_1'] = { id: 'sale_1', saleNo: 'SALE-20261128-0002', status: 'PAID' };
    await completePreOrderClaimForSale(tx as any, {
      preOrderIds: ['po_1'],
      saleId: 'sale_1',
      saleNo: 'SALE-20261128-0002',
      actorUserId: 'user_1',
    });

    expect(state.preOrders[0]).toMatchObject({
      status: 'FULFILLED',
      saleId: 'sale_1',
    });
    expect(state.events).toHaveLength(1);

    // Cashier 2 tries to pay the same order — blocked with 409 + winning bill number
    await expect(
      lockAndVerifyPreOrdersForSale(tx as any, {
        preOrderIds: ['po_1'],
        storeId: 'store_1',
      })
    ).rejects.toMatchObject({
      name: 'PreOrderClaimError',
      statusCode: 409,
      code: 'PRE_ORDER_ALREADY_BILLED',
      existingSaleId: 'sale_1',
      existingSaleNo: 'SALE-20261128-0002',
      trackingCode: '9ERSHE',
    });
  });

  it('blocks billing when an OPEN (unsettled/pending approval) sale already claimed the pre-order', async () => {
    const { tx } = makeFakeTx({
      preOrders: [
        {
          id: 'po_1',
          storeId: 'store_1',
          trackingCode: 'K2A1',
          status: 'FULFILLED',
          saleId: 'sale_open',
        },
      ],
      sales: {
        sale_open: { id: 'sale_open', saleNo: 'SALE-20261128-0003', status: 'OPEN' },
      },
    });

    await expect(
      lockAndVerifyPreOrdersForSale(tx as any, {
        preOrderIds: ['po_1'],
        storeId: 'store_1',
      })
    ).rejects.toBeInstanceOf(PreOrderClaimError);
  });

  it('blocks billing a cancelled order or an order belonging to a different store', async () => {
    const cancelled = makeFakeTx({
      preOrders: [
        { id: 'po_c', storeId: 'store_1', trackingCode: 'CANC1', status: 'CANCELLED', saleId: null },
      ],
    });
    await expect(
      lockAndVerifyPreOrdersForSale(cancelled.tx as any, {
        preOrderIds: ['po_c'],
        storeId: 'store_1',
      })
    ).rejects.toMatchObject({ statusCode: 409, code: 'PRE_ORDER_CLOSED' });

    const wrongStore = makeFakeTx({
      preOrders: [
        { id: 'po_w', storeId: 'store_franchise', trackingCode: 'FRAN1', status: 'READY', saleId: null },
      ],
    });
    await expect(
      lockAndVerifyPreOrdersForSale(wrongStore.tx as any, {
        preOrderIds: ['po_w'],
        storeId: 'store_owner',
      })
    ).rejects.toMatchObject({ statusCode: 409, code: 'PRE_ORDER_WRONG_STORE' });
  });

  it('reopens a pre-order cleanly when its linked mistake bill is voided so it can be re-billed once', async () => {
    const sales: Record<string, { id: string; saleNo: string; status: string }> = {
      sale_bad: { id: 'sale_bad', saleNo: 'SALE-20261128-0002', status: 'VOID' },
    };
    const { tx, state } = makeFakeTx({
      preOrders: [
        {
          id: 'po_1',
          storeId: 'store_1',
          trackingCode: '9ERSHE',
          status: 'FULFILLED',
          saleId: 'sale_bad',
        },
      ],
      sales,
    });

    const released = await releasePreOrdersOnSaleVoid(tx as any, {
      saleId: 'sale_bad',
      saleNo: 'SALE-20261128-0002',
      actorUserId: 'manager_1',
    });
    expect(released).toBe(1);
    expect(state.preOrders[0]).toMatchObject({ status: 'CONFIRMED', saleId: null });
    expect(state.events[0].visibleToCustomer).toBe(false);

    // Can now be billed cleanly once
    const locked = await lockAndVerifyPreOrdersForSale(tx as any, {
      preOrderIds: ['po_1'],
      storeId: 'store_1',
    });
    expect(locked).toHaveLength(1);
  });

  it('translates DB-level PreOrderSaleLink unique/overwrite violations into 409 PRE_ORDER_ALREADY_BILLED', () => {
    const prismaUniqueErr = Object.assign(
      new Error('Unique constraint failed on the constraint: `PreOrderSaleLink_one_active_sale_key`'),
      { code: 'P2002', meta: { target: ['PreOrderSaleLink_one_active_sale_key'] } }
    );
    const mapped = asPreOrderClaimError(prismaUniqueErr, ['po_1']);
    expect(mapped).toBeInstanceOf(PreOrderClaimError);
    expect(mapped).toMatchObject({
      statusCode: 409,
      code: 'PRE_ORDER_ALREADY_BILLED',
      preOrderIds: ['po_1'],
    });

    const overwriteTriggerErr = new Error(
      'PreOrder po_1 is already linked to active Sale sale_1 and cannot be overwritten'
    );
    expect(asPreOrderClaimError(overwriteTriggerErr, ['po_1'])).toMatchObject({
      statusCode: 409,
      code: 'PRE_ORDER_ALREADY_BILLED',
    });

    expect(asPreOrderClaimError(new Error('unrelated database timeout'), ['po_1'])).toBeNull();
  });
});
