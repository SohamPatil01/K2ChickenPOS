import type { PrismaClient } from '@azela-pos/db';
import { ymdInStoreTz } from '@azela-pos/shared';

type Db = Pick<PrismaClient, 'sale'>;

/** One count query per bill — unique constraint handles rare collisions. */
export async function generateSaleNo(db: Db, storeId: string): Promise<string> {
  const today = new Date();
  const dateStr = ymdInStoreTz(today).replace(/-/g, '');
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const count = await db.sale.count({
    where: {
      storeId,
      createdAt: { gte: startOfDay },
    },
  });

  return `SALE-${dateStr}-${String(count + 1).padStart(4, '0')}`;
}
