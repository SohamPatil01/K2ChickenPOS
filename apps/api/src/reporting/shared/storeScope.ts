// @ts-nocheck
import { prisma } from '@azela-pos/db';
import {
  resolveFranchiseStoreIds,
  canAccessStoreResource,
} from '../../utils/storeScope.js';

export { resolveFranchiseStoreIds, canAccessStoreResource };

export async function resolveReportingStoreIds(
  userStoreId: string,
  userRole: string,
  queryStoreId?: string
): Promise<{ storeIds: string[]; storeFilter: string | { in: string[] } } | null> {
  const userStore = await prisma.store.findUnique({
    where: { id: userStoreId },
    select: { id: true, type: true },
  });
  if (!userStore) return null;

  let storeIds: string[];
  if (queryStoreId && queryStoreId !== 'all') {
    const allowed = await canAccessStoreResource(userStoreId, userRole, queryStoreId);
    if (!allowed) return null;
    storeIds = [queryStoreId];
  } else if (userRole === 'OWNER' && userStore.type === 'OWNER' && (!queryStoreId || queryStoreId === 'all')) {
    storeIds = await resolveFranchiseStoreIds(userStoreId, userRole);
  } else {
    storeIds = [userStoreId];
  }

  const storeFilter = storeIds.length === 1 ? storeIds[0]! : { in: storeIds };
  return { storeIds, storeFilter };
}

export function storeIdWhere(storeFilter: string | { in: string[] }) {
  return typeof storeFilter === 'string' ? storeFilter : storeFilter;
}
