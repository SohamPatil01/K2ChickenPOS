// @ts-nocheck
import { prisma } from '@azela-pos/db';

/** Franchise store ids visible to this user (HQ owner sees all child franchises). */
export async function resolveFranchiseStoreIds(
  storeId: string,
  userRole: string
): Promise<string[]> {
  const userStore = await prisma.store.findUnique({
    where: { id: storeId },
    select: { type: true },
  });
  if (userRole === 'OWNER' && userStore?.type === 'OWNER') {
    const franchises = await prisma.store.findMany({
      where: { parentOwnerStoreId: storeId, type: 'FRANCHISE' },
      select: { id: true },
    });
    return [storeId, ...franchises.map((f) => f.id)];
  }
  return [storeId];
}

/** Prisma `where.storeId` filter for list queries. */
export async function resolveStoreIdFilter(
  storeId: string,
  userRole: string
): Promise<string | { in: string[] }> {
  const storeIds = await resolveFranchiseStoreIds(storeId, userRole);
  return storeIds.length > 1 ? { in: storeIds } : storeId;
}

/** Whether the user may access a resource tied to `resourceStoreId`. */
export async function canAccessStoreResource(
  userStoreId: string,
  userRole: string,
  resourceStoreId: string
): Promise<boolean> {
  if (resourceStoreId === userStoreId) return true;
  if (userRole !== 'OWNER') return false;

  const resourceStore = await prisma.store.findUnique({
    where: { id: resourceStoreId },
    select: { type: true, parentOwnerStoreId: true },
  });
  return (
    resourceStore?.type === 'FRANCHISE' &&
    resourceStore.parentOwnerStoreId === userStoreId
  );
}
