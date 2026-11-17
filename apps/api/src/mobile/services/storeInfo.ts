import { prisma } from '@azela-pos/db';
import { HttpError } from '../errors.js';
import { openStatus, weekHours } from '../domain/storeHours.js';
import { getStoreConfig } from './config.js';

/** Public store card: hours, live open status, address, directions and phone. */
export async function getStoreInfo(storeId: string, now = new Date()) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, name: true } });
  if (!store) throw new HttpError(404, 'STORE_NOT_FOUND', 'Store not found');
  const cfg = await getStoreConfig(storeId);
  return {
    store: { id: store.id, name: cfg.appDisplayName?.trim() || store.name },
    address: cfg.addressText,
    mapsUrl: cfg.mapsUrl,
    phone: cfg.supportPhone,
    deliveryEnabled: cfg.deliveryEnabled,
    hours: weekHours(cfg.hours),
    status: openStatus(now, cfg.hours),
    timezone: 'Asia/Kolkata',
  };
}
