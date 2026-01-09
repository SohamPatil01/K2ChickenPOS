// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { createPOSchema } from '@azela-pos/shared';
import { requireRole, getUser } from '../utils/auth.js';

export async function poRoutes(fastify: FastifyInstance) {

  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createPOSchema.parse(request.body as any);
    
    // Get stores - allow both franchise and owner stores to create POs
    const defaultOwnerStore = await prisma.store.findFirst({ where: { type: 'OWNER' }, select: { id: true, name: true, type: true, parentOwnerStoreId: true } });
    const defaultFranchiseStore = await prisma.store.findFirst({ where: { type: 'FRANCHISE' }, select: { id: true, name: true, type: true, parentOwnerStoreId: true } });
    
    // Use provided ownerStoreId or default to first owner store
    let ownerStoreId = data.ownerStoreId || defaultOwnerStore?.id || '';
    
    // For franchise stores, use the franchise store; for owner/manager, use owner store as both
    let franchiseStoreId = defaultFranchiseStore?.id || ownerStoreId;

    // If we have a franchise store, use it; otherwise use owner store as both
    if (defaultFranchiseStore?.id && defaultFranchiseStore.parentOwnerStoreId) {
      franchiseStoreId = defaultFranchiseStore.id;
      ownerStoreId = defaultFranchiseStore.parentOwnerStoreId;
    } else {
      // Owner/Manager creating PO - use owner store as both
      franchiseStoreId = ownerStoreId;
    }

    if (!franchiseStoreId || !ownerStoreId) {
      reply.code(400).send({ error: 'Store configuration error' });
      return;
    }

    // Generate PO number
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const count = await prisma.purchaseOrder.count({
      where: {
        franchiseStoreId,
        createdAt: {
          gte: new Date(today.setHours(0, 0, 0, 0)),
        },
      },
    });
    const poNo = `PO-${dateStr}-${String(count + 1).padStart(4, '0')}`;

    // Try to create PO with Prisma first
    let po;
    try {
      po = await prisma.purchaseOrder.create({
        data: {
          franchiseStoreId,
          ownerStoreId,
          poNo,
          status: 'DRAFT',
          notes: data.notes,
          items: {
            create: data.items.map((item: any) => ({
              productId: item.productId,
              qtyKg: item.qtyKg && item.qtyKg > 0 ? item.qtyKg : null,
              qtyPcs: item.qtyPcs && item.qtyPcs > 0 ? item.qtyPcs : null,
              requestedRate: item.requestedRate || 0,
            })),
          },
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });
    } catch (error: any) {
      // If error is due to missing columns (updatedAt, receivedQtyKg, receivedQtyPcs), create PO and items separately
      const errorMessage = error.message || error.toString() || '';
      if (errorMessage.includes('updatedAt') || errorMessage.includes('does not exist') || errorMessage.includes('column')) {
        console.warn('[PO API] Missing columns in database, creating PO and items separately');
        
        // Create PO first (without items)
        const createdPO = await prisma.purchaseOrder.create({
          data: {
            franchiseStoreId,
            ownerStoreId,
            poNo,
            status: 'DRAFT',
            notes: data.notes,
          },
        });
        
        // Create items one by one, handling missing updatedAt column
        const createdItems = [];
        for (const item of data.items) {
          const qtyKg = item.qtyKg && item.qtyKg > 0 ? item.qtyKg : null;
          const qtyPcs = item.qtyPcs && item.qtyPcs > 0 ? item.qtyPcs : null;
          
          try {
            // Try to create with Prisma first (will work if columns exist)
            const createdItem = await prisma.purchaseOrderItem.create({
              data: {
                poId: createdPO.id,
                productId: item.productId,
                qtyKg,
                qtyPcs,
                requestedRate: item.requestedRate || 0,
              },
            });
            createdItems.push(createdItem);
          } catch (itemError: any) {
            // If updatedAt doesn't exist, use raw SQL without it
            if (itemError.message?.includes('updatedAt') || itemError.message?.includes('does not exist')) {
              const itemResult = await prisma.$queryRawUnsafe(`
                INSERT INTO "PurchaseOrderItem" ("poId", "productId", "qtyKg", "qtyPcs", "requestedRate", "createdAt")
                VALUES ($1, $2, $3, $4, $5, NOW())
                RETURNING *
              `, createdPO.id, item.productId, qtyKg, qtyPcs, item.requestedRate || 0) as any[];
              
              if (itemResult && itemResult.length > 0) {
                createdItems.push(itemResult[0]);
              }
            } else {
              throw itemError;
            }
          }
        }
        
        // Fetch the complete PO with items and products
        const fullPO = await prisma.purchaseOrder.findUnique({
          where: { id: createdPO.id },
          include: {
            items: {
              include: { product: true },
            },
            franchiseStore: {
              select: { id: true, name: true },
            },
            ownerStore: {
              select: { id: true, name: true },
            },
          },
        });
        
        // Add null values for missing columns
        if (fullPO) {
          po = {
            ...fullPO,
            items: fullPO.items.map((item: any) => ({
              ...item,
              receivedQtyKg: item.receivedQtyKg ?? null,
              receivedQtyPcs: item.receivedQtyPcs ?? null,
              updatedAt: item.updatedAt ?? item.createdAt,
            })),
          };
        } else {
          throw new Error('Failed to fetch created purchase order');
        }
      } else {
        throw error;
      }
    }

    return po;
  });

  fastify.get('/', async (request: any, reply: FastifyReply) => {
    try {
      const { startDate, endDate, storeId: queryStoreId, status } = (request.query as any);
      
      // Try to get user's store from authentication, fallback to default store
      let storeId = '';
      let userRole = '';
      
      try {
        const user = getUser(request);
        storeId = queryStoreId || (user as any).storeId || '';
        userRole = (user as any).role || '';
        console.log(`[PO API] Authenticated user - storeId: ${storeId}, role: ${userRole}`);
      } catch (error) {
        // Not authenticated, use query param or default to oldest OWNER store
        if (queryStoreId) {
          storeId = queryStoreId;
          console.log(`[PO API] Using query store ID: ${storeId}`);
        } else {
          console.log('[PO API] User not authenticated, using fallback store');
          const defaultStore = await prisma.store.findFirst({ 
            where: { type: 'OWNER' },
            orderBy: { createdAt: 'asc' }
          });
          storeId = defaultStore?.id || '';
          userRole = 'OWNER';
        }
      }

      if (!storeId) {
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }

      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });

      if (!store) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      const where: any = {};

      // For franchise stores, show POs for that franchise
      if (store.type === 'FRANCHISE') {
        where.franchiseStoreId = storeId;
      } else if (store.type === 'OWNER') {
        // For owner stores, show POs where this is the owner store
        // Optionally, also include POs from all franchises if user is OWNER role
        if (userRole === 'OWNER') {
          // Get all franchise stores under this owner
          const franchises = await prisma.store.findMany({
            where: {
              type: 'FRANCHISE',
              parentOwnerStoreId: storeId,
            },
            select: { id: true },
          });
          const franchiseIds = franchises.map(f => f.id);
          
          // Show POs where ownerStoreId matches OR franchiseStoreId is one of the franchises
          where.OR = [
            { ownerStoreId: storeId },
            { franchiseStoreId: { in: [storeId, ...franchiseIds] } }
          ];
        } else {
          // For non-OWNER roles, just show POs for this owner store
          where.ownerStoreId = storeId;
        }
      }

      if (status) {
        where.status = status;
      }

      // Add date filtering if provided
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
      }

      // Try to fetch POs with all fields first
      // If database doesn't have new columns (receivedQtyKg, receivedQtyPcs), catch error and use fallback
      let pos;
      try {
        pos = await prisma.purchaseOrder.findMany({
          where,
          include: {
            items: {
              include: { product: true },
            },
            franchiseStore: {
              select: { id: true, name: true },
            },
            ownerStore: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      } catch (error: any) {
        // If error is due to missing columns (receivedQtyKg, receivedQtyPcs), fetch without those fields
        const errorMessage = error.message || error.toString() || '';
        const isColumnError = errorMessage.includes('receivedQtyKg') || 
                             errorMessage.includes('receivedQtyPcs') || 
                             errorMessage.includes('does not exist') || 
                             errorMessage.includes('column') ||
                             errorMessage.includes('Invalid');
        
        if (isColumnError) {
          console.warn('[PO API] Missing new columns in database, fetching without receivedQtyKg/receivedQtyPcs');
          console.warn('[PO API] Error details:', errorMessage);
          
          try {
            // Fetch POs and items separately, then manually join
            const posWithoutItems = await prisma.purchaseOrder.findMany({
              where,
              include: {
                franchiseStore: {
                  select: { id: true, name: true },
                },
                ownerStore: {
                  select: { id: true, name: true },
                },
              },
              orderBy: { createdAt: 'desc' },
            });
            
            // Fetch items separately using raw query to avoid column errors
            const poIds = posWithoutItems.map(po => po.id);
            if (poIds.length === 0) {
              pos = [];
            } else {
              // Use Prisma's queryRawUnsafe with proper array formatting
              // Build placeholders for the array
              const placeholders = poIds.map((_, i) => `$${i + 1}`).join(', ');
              const items = await prisma.$queryRawUnsafe(
                `SELECT 
                  poi.id,
                  poi."poId",
                  poi."productId",
                  poi."qtyKg",
                  poi."qtyPcs",
                  poi."requestedRate",
                  poi."createdAt",
                  p.id as "product_id",
                  p.name as "product_name",
                  p.sku as "product_sku",
                  p.plu as "product_plu",
                  p."unitType" as "product_unitType",
                  p."imageUrl" as "product_imageUrl",
                  p."isActive" as "product_isActive"
                FROM "PurchaseOrderItem" poi
                LEFT JOIN "Product" p ON p.id = poi."productId"
                WHERE poi."poId" IN (${placeholders})`,
                ...poIds
              ) as any[];
              
              // Group items by poId
              const itemsByPoId = new Map<string, any[]>();
              items.forEach((item: any) => {
                if (!itemsByPoId.has(item.poId)) {
                  itemsByPoId.set(item.poId, []);
                }
                itemsByPoId.get(item.poId)!.push({
                  id: item.id,
                  poId: item.poId,
                  productId: item.productId,
                  qtyKg: item.qtyKg,
                  qtyPcs: item.qtyPcs,
                  requestedRate: item.requestedRate,
                  receivedQtyKg: null, // Default to null for missing columns
                  receivedQtyPcs: null,
                  createdAt: item.createdAt,
                  product: item.product_id ? {
                    id: item.product_id,
                    name: item.product_name,
                    sku: item.product_sku,
                    plu: item.product_plu,
                    unitType: item.product_unitType,
                    imageUrl: item.product_imageUrl,
                    isActive: item.product_isActive,
                  } : null,
                });
              });
              
              // Combine POs with their items
              pos = posWithoutItems.map(po => ({
                ...po,
                items: itemsByPoId.get(po.id) || [],
              }));
            }
          } catch (fallbackError: any) {
            console.error('[PO API] Fallback query also failed:', fallbackError);
            // If fallback also fails, return empty array or rethrow
            throw new Error(`Failed to fetch POs: ${fallbackError.message || fallbackError}`);
          }
        } else {
          // Not a column error, rethrow
          console.error('[PO API] Unexpected error:', error);
          throw error;
        }
      }

      return pos;
    } catch (error: any) {
      console.error('Failed to fetch purchase orders:', error);
      reply.code(500).send({ error: 'Failed to fetch purchase orders', details: error.message });
    }
  });

  fastify.post('/:id/submit', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const store = await prisma.store.findFirst({ where: { type: 'FRANCHISE' }, select: { id: true, name: true, type: true, parentOwnerStoreId: true } });
      const storeId = store?.id || '';

      const po = await prisma.purchaseOrder.findUnique({
        where: { id },
      });

      if (!po || po.franchiseStoreId !== storeId) {
        reply.code(404).send({ error: 'PO not found' });
        return;
      }

      if (po.status !== 'DRAFT') {
        reply.code(400).send({ error: 'PO cannot be submitted' });
        return;
      }

      const updated = await prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'SUBMITTED' },
      });

      return updated;
    } catch (error: any) {
      console.error('Failed to submit PO:', error);
      reply.code(500).send({ error: 'Failed to submit PO', details: error.message });
    }
  });

  fastify.post('/:id/approve', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const user = getUser(request);
      const userStoreId = user.storeId;

      // Get user's store to check if it's an owner store
      const userStore = await prisma.store.findUnique({
        where: { id: userStoreId },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });

      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      // Determine the owner store ID (could be the user's store or parent)
      const ownerStoreId = userStore.type === 'OWNER' ? userStore.id : userStore.parentOwnerStoreId;
      
      if (!ownerStoreId) {
        reply.code(400).send({ error: 'Owner store not found' });
        return;
      }

      const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      if (!po) {
        reply.code(404).send({ error: 'PO not found' });
        return;
      }

      // Check if PO belongs to the owner store
      if (po.ownerStoreId !== ownerStoreId) {
        reply.code(403).send({ error: 'Access denied. PO does not belong to your store.' });
        return;
      }

      // Allow approval of DRAFT or SUBMITTED POs
      if (po.status !== 'SUBMITTED' && po.status !== 'DRAFT') {
        reply.code(400).send({ error: `PO cannot be approved. Current status: ${po.status}` });
        return;
      }

      // Update PO status to APPROVED
      // Note: Inventory will be added when PO is finalized (after editing received quantities)
      const updated = await prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'APPROVED' },
      });

      return updated;
    } catch (error: any) {
      console.error('Failed to approve PO:', error);
      if (error.message === 'User not authenticated') {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }
      reply.code(500).send({ error: 'Failed to approve PO', details: error.message });
    }
  });

  fastify.post('/:id/reject', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const store = await prisma.store.findFirst({ where: { type: 'OWNER' }, select: { id: true, name: true, type: true, parentOwnerStoreId: true } });
      const storeId = store?.id || '';

      const po = await prisma.purchaseOrder.findUnique({
        where: { id },
      });

      if (!po || po.ownerStoreId !== storeId) {
        reply.code(404).send({ error: 'PO not found' });
        return;
      }

      if (po.status !== 'SUBMITTED') {
        reply.code(400).send({ error: 'PO cannot be rejected' });
        return;
      }

      const updated = await prisma.purchaseOrder.update({
        where: { id },
        data: {
          status: 'REJECTED',
          notes: (request.body as any).reason ? `${po.notes || ''}\nRejected: ${(request.body as any).reason}` : po.notes,
        },
      });

      return updated;
    } catch (error: any) {
      console.error('Failed to reject PO:', error);
      reply.code(500).send({ error: 'Failed to reject PO', details: error.message });
    }
  });

  fastify.post('/:id/dispatch', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const store = await prisma.store.findFirst({ where: { type: 'OWNER' }, select: { id: true, name: true, type: true, parentOwnerStoreId: true } });
      const storeId = store?.id || '';

      const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!po || po.ownerStoreId !== storeId) {
        reply.code(404).send({ error: 'PO not found' });
        return;
      }

      if (po.status !== 'APPROVED') {
        reply.code(400).send({ error: 'PO must be approved to dispatch' });
        return;
      }

      // Generate dispatch number
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
      const count = await prisma.dispatch.count({
        where: {
          createdAt: {
            gte: new Date(today.setHours(0, 0, 0, 0)),
          },
        },
      });
      const dispatchNo = `DISP-${dateStr}-${String(count + 1).padStart(4, '0')}`;

      const dispatch = await prisma.dispatch.create({
        data: {
          poId: id,
          dispatchNo,
          status: 'CREATED',
          items: {
            create: po.items.map((item: any) => ({
              productId: item.productId,
              qtyKg: item.qtyKg,
              qtyPcs: item.qtyPcs,
            })),
          },
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      await prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'DISPATCHED' },
      });

      return dispatch;
    } catch (error: any) {
      console.error('Failed to dispatch PO:', error);
      reply.code(500).send({ error: 'Failed to dispatch PO', details: error.message });
    }
  });

  fastify.post('/dispatch/:dispatchId/receive', async (request: any, reply: FastifyReply) => {
    try {
      const { dispatchId } = (request.params as any);
      // Get default store and user (since auth is disabled for now)
      const store = await prisma.store.findFirst({ where: { type: 'FRANCHISE' }, select: { id: true, name: true, type: true, parentOwnerStoreId: true } });
      const storeId = store?.id || '';
      const user = await prisma.user.findFirst({ where: { role: 'MANAGER' } });
      const userId = user?.id || '';

      const dispatch = await prisma.dispatch.findUnique({
        where: { id: dispatchId },
        include: {
          items: true,
          po: true,
        },
      });

      if (!dispatch || dispatch.po.franchiseStoreId !== storeId) {
        reply.code(404).send({ error: 'Dispatch not found' });
        return;
      }

      // Create GRN
      const grn = await prisma.gRN.create({
        data: {
          dispatchId,
          receivedBy: userId,
          status: 'RECEIVED',
        },
      });

      // Update inventory
      for (const item of dispatch.items) {
        await prisma.inventoryLedger.create({
          data: {
            storeId,
            productId: item.productId,
            type: 'IN',
            qtyKg: item.qtyKg,
            qtyPcs: item.qtyPcs,
            reason: 'RECEIVE',
            refId: dispatchId,
          },
        });
      }

      // Update PO status
      await prisma.purchaseOrder.update({
        where: { id: dispatch.poId },
        data: { status: 'RECEIVED' },
      });

      return grn;
    } catch (error: any) {
      console.error('Failed to receive dispatch:', error);
      reply.code(500).send({ error: 'Failed to receive dispatch', details: error.message });
    }
  });

  // Update received quantities for PO items (to account for shrinkage)
  fastify.put('/:id/receive', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const { items } = (request.body as any); // Array of { itemId, receivedQtyKg?, receivedQtyPcs? }

      if (!items || !Array.isArray(items)) {
        reply.code(400).send({ error: 'Items array is required' });
        return;
      }

      const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!po) {
        reply.code(404).send({ error: 'PO not found' });
        return;
      }

      // Only allow updating received quantities for RECEIVED or DISPATCHED POs
      if (po.status !== 'RECEIVED' && po.status !== 'DISPATCHED') {
        reply.code(400).send({ error: 'PO must be RECEIVED or DISPATCHED to update received quantities' });
        return;
      }

      // Update each item with received quantities
      for (const itemUpdate of items) {
        const item = po.items.find((i) => i.id === itemUpdate.itemId);
        if (!item) {
          continue; // Skip if item not found
        }

        await prisma.purchaseOrderItem.update({
          where: { id: itemUpdate.itemId },
          data: {
            receivedQtyKg: itemUpdate.receivedQtyKg !== undefined ? itemUpdate.receivedQtyKg : null,
            receivedQtyPcs: itemUpdate.receivedQtyPcs !== undefined ? itemUpdate.receivedQtyPcs : null,
          },
        });
      }

      // Reload PO with updated items
      const updatedPO = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      return updatedPO;
    } catch (error: any) {
      console.error('Failed to update received quantities:', error);
      reply.code(500).send({ error: 'Failed to update received quantities', details: error.message });
    }
  });

  // Finalize PO - add received stock to inventory
  fastify.post('/:id/finalize', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);

      const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      if (!po) {
        reply.code(404).send({ error: 'PO not found' });
        return;
      }

      // Only allow finalizing RECEIVED or DISPATCHED POs
      if (po.status !== 'RECEIVED' && po.status !== 'DISPATCHED') {
        reply.code(400).send({ error: 'PO must be RECEIVED or DISPATCHED to finalize' });
        return;
      }

      // Check if PO already has inventory entries (from approve)
      const existingInventoryEntries = await prisma.inventoryLedger.findMany({
        where: {
          refId: id,
          reason: 'RECEIVE',
        },
      });

      // If inventory was already added (from approve), we need to adjust it
      // Delete old entries and create new ones with received quantities
      if (existingInventoryEntries.length > 0) {
        // Delete existing inventory entries
        await prisma.inventoryLedger.deleteMany({
          where: {
            refId: id,
            reason: 'RECEIVE',
          },
        });
      }

      const franchiseStoreId = po.franchiseStoreId;
      const inventoryEntries = [];

      console.log(`[PO Finalize] Finalizing PO ${po.poNo} (${id}) for store ${franchiseStoreId}`);
      console.log(`[PO Finalize] PO has ${po.items.length} items`);

      // Add inventory for each item using received quantities (or original if not set)
      for (const item of po.items) {
        // Use received quantities if available, otherwise use original quantities
        const qtyKg = item.receivedQtyKg !== null && item.receivedQtyKg !== undefined 
          ? item.receivedQtyKg 
          : item.qtyKg;
        const qtyPcs = item.receivedQtyPcs !== null && item.receivedQtyPcs !== undefined 
          ? item.receivedQtyPcs 
          : item.qtyPcs;

        console.log(`[PO Finalize] Item ${item.product?.name || item.productId}: originalKg=${item.qtyKg}, receivedKg=${item.receivedQtyKg}, finalKg=${qtyKg}`);

        // Skip items with no quantity
        const hasQtyKg = qtyKg !== null && qtyKg !== undefined && qtyKg > 0;
        const hasQtyPcs = qtyPcs !== null && qtyPcs !== undefined && qtyPcs > 0;

        if (!hasQtyKg && !hasQtyPcs) {
          console.warn(`[PO Finalize] Skipping item ${item.productId} - no valid quantity`);
          continue;
        }

        const ledgerEntry: any = {
          storeId: franchiseStoreId,
          productId: item.productId,
          type: 'IN',
          reason: 'RECEIVE',
          refId: id, // Ensure refId is always set
        };

        if (hasQtyKg) {
          ledgerEntry.qtyKg = qtyKg;
        }

        if (hasQtyPcs) {
          ledgerEntry.qtyPcs = qtyPcs;
        }

        console.log(`[PO Finalize] Creating ledger entry:`, ledgerEntry);

        try {
          const created = await prisma.inventoryLedger.create({
            data: ledgerEntry,
          });
          console.log(`[PO Finalize] ✅ Created ledger entry ${created.id} for product ${item.productId}`);
          inventoryEntries.push(created);
        } catch (error: any) {
          console.error(`[PO Finalize] ❌ Failed to create inventory ledger entry:`, error);
          console.error(`[PO Finalize] Error details:`, error.message, error.stack);
        }
      }

      console.log(`[PO Finalize] Created ${inventoryEntries.length} inventory entries`);

      // Update PO status to CLOSED
      const updated = await prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'CLOSED' },
      });

      return {
        ...updated,
        inventoryEntriesCreated: inventoryEntries.length,
      };
    } catch (error: any) {
      console.error('Failed to finalize PO:', error);
      reply.code(500).send({ error: 'Failed to finalize PO', details: error.message });
    }
  });
}

