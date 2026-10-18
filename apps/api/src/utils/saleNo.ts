import type { PrismaClient } from '@azela-pos/db';
import { ymdInStoreTz } from '@azela-pos/shared';

type Db = Pick<PrismaClient, 'sale'>;

/** One indexed lookup per bill — unique constraint handles rare collisions. */
export async function generateSaleNo(db: Db, storeId: string): Promise<string> {
  const today = new Date();
  const dateStr = ymdInStoreTz(today).replace(/-/g, '');
  const prefix = `SALE-${dateStr}-`;
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  // Prefer last saleNo of the day (uses storeId+createdAt index) over a full count scan.
  const last = await db.sale.findFirst({
    where: {
      storeId,
      createdAt: { gte: startOfDay },
      saleNo: { startsWith: prefix },
    },
    orderBy: { createdAt: 'desc' },
    select: { saleNo: true },
  });

  let next = 1;
  if (last?.saleNo) {
    const n = parseInt(String(last.saleNo).slice(prefix.length), 10);
    if (Number.isFinite(n) && n >= 0) next = n + 1;
  }

  return `${prefix}${String(next).padStart(4, '0')}`;
}
