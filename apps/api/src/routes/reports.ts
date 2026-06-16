// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { addToMasaleSplit, emptyMasaleSplit, isMasaleProduct, masaleSplitFromRows } from '@azela-pos/shared';
import { getUser, requireRole } from '../utils/auth.js';

interface QueryParams {
  startDate?: string;
  endDate?: string;
  storeId?: string;
  productId?: string;
  categoryId?: string;
}

/** Store timezone for report date boundaries (India). */
const REPORT_TZ = '+05:30';
const REPORT_TZ_IANA = 'Asia/Kolkata';

function ymdInReportTz(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: REPORT_TZ_IANA });
}

function getReportDateRange(startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    if (String(startDate).includes('T') && String(endDate).includes('T')) {
      return {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }
    const startStr = String(startDate).split('T')[0];
    const endStr = String(endDate).split('T')[0];
    if (isNaN(new Date(`${startStr}T00:00:00.000${REPORT_TZ}`).getTime())) {
      const endDefault = new Date();
      const startDefault = new Date();
      startDefault.setDate(startDefault.getDate() - 30);
      return {
        gte: new Date(`${ymdInReportTz(startDefault)}T00:00:00.000${REPORT_TZ}`),
        lte: new Date(`${ymdInReportTz(endDefault)}T23:59:59.999${REPORT_TZ}`),
      };
    }
    return {
      gte: new Date(`${startStr}T00:00:00.000${REPORT_TZ}`),
      lte: new Date(`${endStr}T23:59:59.999${REPORT_TZ}`),
    };
  }
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    gte: new Date(`${ymdInReportTz(start)}T00:00:00.000${REPORT_TZ}`),
    lte: new Date(`${ymdInReportTz(end)}T23:59:59.999${REPORT_TZ}`),
  };
}

function getDateRange(startDate?: string, endDate?: string) {
  return getReportDateRange(startDate, endDate);
}

async function resolveReportStoreIds(user: any, queryStoreId?: string) {
  const userStore = await prisma.store.findUnique({
    where: { id: user.storeId },
    select: { id: true, type: true, parentOwnerStoreId: true },
  });
  if (!userStore) return null;

  let storeIds: string[] = [queryStoreId || user.storeId];
  if (userStore.type === 'OWNER' && (!queryStoreId || queryStoreId === 'all')) {
    const franchises = await prisma.store.findMany({
      where: {
        type: 'FRANCHISE',
        parentOwnerStoreId: userStore.id,
      },
      select: { id: true },
    });
    storeIds = [userStore.id, ...franchises.map((f) => f.id)];
  }

  const storeIdWhere = storeIds.length > 1 ? { in: storeIds } : storeIds[0];
  return { userStore, storeIds, storeIdWhere };
}

/** Prefer businessDate when set (POS business day), else sale createdAt, in store TZ. */
function saleDateKey(sale: { businessDate?: Date | null; createdAt: Date }): string {
  const d = sale.businessDate ? new Date(sale.businessDate) : new Date(sale.createdAt);
  return ymdInReportTz(d);
}

/** Date + store filter only (flat OR — matches analytics queries). */
function reportSalesDateWhere(storeId: any, startDate?: string, endDate?: string) {
  const dateFilter = getReportDateRange(startDate, endDate);
  return {
    storeId,
    OR: [
      { createdAt: { gte: dateFilter.gte, lte: dateFilter.lte } },
      { businessDate: { gte: dateFilter.gte, lte: dateFilter.lte } },
    ],
  };
}

/** PAID sales + OPEN credit bills in range (two simple queries, merged). */
async function fetchReportableSales(
  storeId: any,
  startDate: string | undefined,
  endDate: string | undefined,
  query: { include?: any; select?: any; orderBy?: any } = {}
) {
  const base = reportSalesDateWhere(storeId, startDate, endDate);
  const paidSales = await prisma.sale.findMany({ ...query, where: { ...base, status: 'PAID' } });

  let openCreditSales: any[] = [];
  try {
    openCreditSales = await prisma.sale.findMany({
      ...query,
      where: { ...base, status: 'OPEN', payments: { some: { method: 'CREDIT' } } },
    });
  } catch (err: any) {
    const msg = String(err?.message || err);
    // Production DB may lack CREDIT on PaymentMethod enum until migration is applied
    if (msg.includes('PaymentMethod') || msg.includes('CREDIT') || msg.includes('22P02')) {
      console.warn('[Reports] CREDIT not in PaymentMethod enum; returning PAID sales only');
    } else {
      throw err;
    }
  }

  const byId = new Map<string, any>();
  for (const sale of [...paidSales, ...openCreditSales]) {
    byId.set(sale.id, sale);
  }

  let merged = [...byId.values()];
  const order = query.orderBy?.createdAt;
  if (order === 'desc') {
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (order === 'asc') {
    merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  return merged;
}

function itemMasaleFlag(item: {
  product?: { name?: string; category?: { name?: string } | null } | null;
  category?: string;
  productName?: string;
}): boolean {
  return isMasaleProduct(
    item.product?.category?.name ?? item.category,
    item.product?.name ?? item.productName
  );
}

function masaleTotalsFromSaleItems(items: any[]) {
  const totals = emptyMasaleSplit();
  for (const item of items || []) {
    if (!item) continue;
    addToMasaleSplit(totals, {
      isMasale: itemMasaleFlag(item),
      revenue: item.lineTotal || 0,
      qtyKg: item.qtyKg || 0,
      qtyPcs: item.qtyPcs || 0,
    });
  }
  return totals;
}

export async function reportRoutes(fastify: FastifyInstance) {
  // Stock Report
  fastify.get('/stock', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      
      console.log('[Stock Report] Request params:', { startDate, endDate, queryStoreId, userId: user.userId });
      
      // Get user's store
      const userStore = await prisma.store.findUnique({
        where: { id: user.storeId },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });

      if (!userStore) {
        console.error('[Stock Report] Store not found:', user.storeId);
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      // Determine which store to use for prices / ledger aggregation
      const resolved = await resolveReportStoreIds(user, queryStoreId);
      if (!resolved) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }
      const userStoreId = queryStoreId || user.storeId;
      const ledgerStoreFilter = resolved.storeIdWhere;
      
      // Get owner store ID
      const ownerStoreId = userStore.type === 'OWNER' ? userStore.id : userStore.parentOwnerStoreId;
      if (!ownerStoreId) {
        reply.code(400).send({ error: 'Owner store not found' });
        return;
      }

      const products = await prisma.product.findMany({
      where: {
        ownerStoreId,
        isActive: true,
      },
      include: {
        category: true,
        storeProductPrices: {
          where: {
            storeId: userStoreId,
            isActive: true,
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
        inventoryLedgers: {
          where: { storeId: ledgerStoreFilter },
          orderBy: { createdAt: 'desc' },
        },
      },
      });

      const stockData = products.map((product: any) => {
      // Calculate KG and PCS separately - don't mix units
      let inQtyKg = 0;
      let inQtyPcs = 0;
      let outQtyKg = 0;
      let outQtyPcs = 0;
      
      product.inventoryLedgers.forEach((l: any) => {
        // Handle null/undefined values properly
        const qtyKg = l.qtyKg !== null && l.qtyKg !== undefined ? l.qtyKg : 0;
        const qtyPcs = l.qtyPcs !== null && l.qtyPcs !== undefined ? l.qtyPcs : 0;
        
        if (l.type === 'IN') {
          inQtyKg += qtyKg;
          inQtyPcs += qtyPcs;
        } else {
          outQtyKg += qtyKg;
          outQtyPcs += qtyPcs;
        }
      });
      
      // Round to 3 decimal places for KG (for consistency with other calculations), integer for PCS
      const currentQtyKg = Math.round((Math.max(0, inQtyKg - outQtyKg)) * 1000) / 1000;
      const currentQtyPcs = Math.max(0, Math.round(inQtyPcs - outQtyPcs));
      
      // For display, use the appropriate unit based on product unitType
      const currentStock = product.unitType === 'KG' ? currentQtyKg : currentQtyPcs;

      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        plu: product.plu,
        category: product.category?.name || '',
        unitType: product.unitType,
        isMasale: isMasaleProduct(product.category?.name, product.name),
        currentStock: currentStock > 0 ? currentStock : 0,
        price: product.storeProductPrices[0]?.pricePerUnit || 0,
        stockValue: (currentStock > 0 ? currentStock : 0) * (product.storeProductPrices[0]?.pricePerUnit || 0),
      };
      });

      return stockData;
    } catch (error: any) {
      console.error('Stock report error:', error);
      reply.code(500).send({ error: 'Failed to generate stock report', details: error.message });
    }
  });

  // Product Wise Sale Report
  fastify.get('/product-wise-sale', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      
      if (!user.storeId) {
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }

      // Get user's store
      const userStore = await prisma.store.findUnique({
        where: { id: user.storeId },
        select: { id: true, type: true, parentOwnerStoreId: true },
      });

      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      // For OWNER stores, include sales from all franchise stores
      let storeIds: string[] = [queryStoreId || user.storeId];
      if (userStore.type === 'OWNER' && (!queryStoreId || queryStoreId === 'all')) {
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: userStore.id,
          },
          select: { id: true },
        });
        storeIds = [userStore.id, ...franchises.map(f => f.id)];
        console.log('[Product-wise Report] Owner store - including franchises:', storeIds);
      }

    const dateFilter = getReportDateRange(startDate, endDate);
    console.log('[Product-wise Report] Date filter:', dateFilter);
    console.log('[Product-wise Report] Store IDs:', storeIds);

    const sales = await fetchReportableSales(
      storeIds.length > 1 ? { in: storeIds } : storeIds[0],
      startDate,
      endDate,
      {
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
      }
    );
    
    console.log(`Found ${sales.length} sales for product-wise report`);

    const productStats: Record<string, any> = {};

    for (const sale of sales) {
      for (const item of sale.items) {
        if (!item.product) continue;
        const key = item.productId;
        if (!productStats[key]) {
          productStats[key] = {
            productId: item.productId,
            productName: item.product.name,
            sku: item.product.sku,
            category: item.product.category?.name || '',
            unitType: item.product.unitType,
            isMasale: isMasaleProduct(item.product.category?.name, item.product.name),
            qtyKg: 0,
            qtyPcs: 0,
            totalQty: 0,
            revenue: 0,
            salesCount: 0,
          };
        }
        productStats[key].qtyKg = Math.round((productStats[key].qtyKg + (item.qtyKg || 0)) * 100) / 100;
        productStats[key].qtyPcs = Math.round(productStats[key].qtyPcs + (item.qtyPcs || 0));
        productStats[key].totalQty = Math.round((productStats[key].totalQty + (item.qtyKg || 0) + (item.qtyPcs || 0)) * 100) / 100;
        // Round revenue to 3 decimal places for consistency with other financial calculations
        productStats[key].revenue = Math.round((productStats[key].revenue + item.lineTotal) * 1000) / 1000;
        productStats[key].salesCount += 1;
      }
    }

      return Object.values(productStats).sort((a: any, b: any) => b.revenue - a.revenue);
    } catch (error: any) {
      console.error('Product-wise sale report error:', error);
      reply.code(500).send({ error: 'Failed to generate product-wise sale report', details: error.message });
    }
  });

  // Daily product transaction totals (date × product)
  fastify.get('/daily-product-transaction', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);

      if (!user.storeId) {
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }

      const userStore = await prisma.store.findUnique({
        where: { id: user.storeId },
        select: { id: true, type: true, parentOwnerStoreId: true },
      });

      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      let storeIds: string[] = [queryStoreId || user.storeId];
      if (userStore.type === 'OWNER' && (!queryStoreId || queryStoreId === 'all')) {
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: userStore.id,
          },
          select: { id: true },
        });
        storeIds = [userStore.id, ...franchises.map(f => f.id)];
      }

      const dateFilter = getReportDateRange(startDate, endDate);
      const rangeStartKey = (startDate || ymdInReportTz(dateFilter.gte)).split('T')[0];
      const rangeEndKey = (endDate || ymdInReportTz(dateFilter.lte)).split('T')[0];

      const sales = await fetchReportableSales(
        storeIds.length > 1 ? { in: storeIds } : storeIds[0],
        startDate,
        endDate,
        {
          select: {
            id: true,
            businessDate: true,
            createdAt: true,
            items: {
              include: {
                product: {
                  include: { category: true },
                },
              },
            },
          },
        }
      );

      const stats: Record<string, any> = {};
      const masaleByDate: Record<string, { revenue: number; qtyKg: number; qtyPcs: number; lineCount: number }> = {};

      for (const sale of sales) {
        const dateKey = saleDateKey(sale);

        for (const item of sale.items) {
          if (!item.product) continue;
          const isMasale = isMasaleProduct(item.product.category?.name, item.product.name);
          const key = `${dateKey}:${item.productId}`;
          if (!stats[key]) {
            stats[key] = {
              date: dateKey,
              productId: item.productId,
              productName: item.product.name,
              sku: item.product.sku,
              category: item.product.category?.name || '',
              unitType: item.product.unitType,
              isMasale,
              qtyKg: 0,
              qtyPcs: 0,
              revenue: 0,
              lineCount: 0,
            };
          }
          stats[key].qtyKg = Math.round((stats[key].qtyKg + (item.qtyKg || 0)) * 100) / 100;
          stats[key].qtyPcs += item.qtyPcs || 0;
          stats[key].revenue = Math.round((stats[key].revenue + item.lineTotal) * 1000) / 1000;
          stats[key].lineCount += 1;

          if (isMasale) {
            if (!masaleByDate[dateKey]) {
              masaleByDate[dateKey] = { revenue: 0, qtyKg: 0, qtyPcs: 0, lineCount: 0 };
            }
            masaleByDate[dateKey].revenue =
              Math.round((masaleByDate[dateKey].revenue + item.lineTotal) * 1000) / 1000;
            masaleByDate[dateKey].qtyKg =
              Math.round((masaleByDate[dateKey].qtyKg + (item.qtyKg || 0)) * 100) / 100;
            masaleByDate[dateKey].qtyPcs += item.qtyPcs || 0;
            masaleByDate[dateKey].lineCount += 1;
          }
        }
      }

      const rows = Object.values(stats).sort((a: any, b: any) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        if (a.isMasale !== b.isMasale) return a.isMasale ? 1 : -1;
        return b.revenue - a.revenue;
      });

      const dailyTotalsMap: Record<
        string,
        {
          date: string;
          revenue: number;
          chickenRevenue: number;
          masaleRevenue: number;
          qtyKg: number;
          qtyPcs: number;
          masaleQtyPcs: number;
        }
      > = {};

      for (const row of rows) {
        if (!dailyTotalsMap[row.date]) {
          dailyTotalsMap[row.date] = {
            date: row.date,
            revenue: 0,
            chickenRevenue: 0,
            masaleRevenue: 0,
            qtyKg: 0,
            qtyPcs: 0,
            masaleQtyPcs: 0,
          };
        }
        const day = dailyTotalsMap[row.date];
        day.revenue = Math.round((day.revenue + row.revenue) * 1000) / 1000;
        day.qtyKg = Math.round((day.qtyKg + row.qtyKg) * 100) / 100;
        day.qtyPcs += row.qtyPcs || 0;
        if (row.isMasale) {
          day.masaleRevenue = Math.round((day.masaleRevenue + row.revenue) * 1000) / 1000;
          day.masaleQtyPcs += row.qtyPcs || 0;
        } else {
          day.chickenRevenue = Math.round((day.chickenRevenue + row.revenue) * 1000) / 1000;
        }
      }

      const dailyTotals = Object.values(dailyTotalsMap).sort((a, b) =>
        b.date.localeCompare(a.date)
      );

      const uniqueDays = new Set(rows.map((r: any) => r.date));
      const masaleSplit = masaleSplitFromRows(rows);
      const summary = {
        totalRevenue: Math.round(rows.reduce((s: number, r: any) => s + r.revenue, 0) * 1000) / 1000,
        totalQtyKg: Math.round(rows.reduce((s: number, r: any) => s + r.qtyKg, 0) * 100) / 100,
        totalQtyPcs: rows.reduce((s: number, r: any) => s + r.qtyPcs, 0),
        productDayCount: rows.length,
        daysCount: uniqueDays.size,
        masaleRevenue: masaleSplit.masaleRevenue,
        masaleQtyKg: masaleSplit.masaleQtyKg,
        masaleQtyPcs: masaleSplit.masaleQtyPcs,
        masaleLineCount: masaleSplit.masaleLineCount,
        otherRevenue: masaleSplit.otherRevenue,
        otherQtyKg: masaleSplit.otherQtyKg,
        otherQtyPcs: masaleSplit.otherQtyPcs,
      };

      return {
        period: { startDate: rangeStartKey, endDate: rangeEndKey },
        summary,
        dailyTotals,
        masaleByDate,
        rows,
      };
    } catch (error: any) {
      console.error('Daily product transaction report error:', error);
      reply.code(500).send({ error: 'Failed to generate daily product transaction report', details: error.message });
    }
  });

  // Bill Wise Sale Report
  fastify.get('/bill-wise-sale', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      
      if (!user.storeId) {
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }

      // Get user's store
      const userStore = await prisma.store.findUnique({
        where: { id: user.storeId },
        select: { id: true, type: true, parentOwnerStoreId: true },
      });

      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      // For OWNER stores, include sales from all franchise stores
      let storeIds: string[] = [queryStoreId || user.storeId];
      if (userStore.type === 'OWNER' && (!queryStoreId || queryStoreId === 'all')) {
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: userStore.id,
          },
          select: { id: true },
        });
        storeIds = [userStore.id, ...franchises.map(f => f.id)];
        console.log('[Bill-wise Report] Owner store - including franchises:', storeIds);
      }

    const dateFilter = getDateRange(startDate, endDate);
    console.log('[Bill-wise Report] Date filter:', dateFilter);

    const sales = await fetchReportableSales(
      storeIds.length > 1 ? { in: storeIds } : storeIds[0],
      startDate,
      endDate,
      {
        include: {
          customer: true,
        items: {
          include: {
            product: { include: { category: true } },
          },
        },
        payments: true,
        createdBy: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      }
    );

    return sales.map((sale) => {
      const masale = masaleTotalsFromSaleItems(sale.items);
      return {
      saleId: sale.id,
      saleNo: sale.saleNo,
      date: sale.createdAt,
      customerName: sale.customer?.name || 'Walk-in',
      customerPhone: sale.customer?.phone || 'N/A',
      itemsCount: sale.items.length,
      subTotal: sale.subTotal,
      discount: sale.discountTotal,
      tax: sale.taxTotal,
      grandTotal: sale.grandTotal,
      masaleRevenue: masale.masaleRevenue,
      masaleQtyPcs: masale.masaleQtyPcs,
      masaleQtyKg: masale.masaleQtyKg,
      payments: sale.payments.map((p: any) => ({
        method: p.method,
        amount: p.amount,
      })),
      createdBy: sale.createdBy.name,
      items: sale.items
        .filter((item: any) => item.product)
        .map((item: any) => ({
          productName: item.product.name,
          sku: item.product.sku,
          isMasale: isMasaleProduct(item.product.category?.name, item.product.name),
          qtyKg: item.qtyKg,
          qtyPcs: item.qtyPcs,
          rate: item.rate,
          lineTotal: item.lineTotal,
        })),
    };
    });
    } catch (error: any) {
      console.error('Bill-wise sale report error:', error);
      reply.code(500).send({ error: 'Failed to generate bill-wise sale report', details: error.message });
    }
  });

  // Sales Register Summary
  fastify.get('/sales-register-summary', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      
      if (!user.storeId) {
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }

      // Get user's store
      const userStore = await prisma.store.findUnique({
        where: { id: user.storeId },
        select: { id: true, type: true, parentOwnerStoreId: true },
      });

      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      // For OWNER stores, include sales from all franchise stores
      let storeIds: string[] = [queryStoreId || user.storeId];
      if (userStore.type === 'OWNER' && (!queryStoreId || queryStoreId === 'all')) {
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: userStore.id,
          },
          select: { id: true },
        });
        storeIds = [userStore.id, ...franchises.map(f => f.id)];
        console.log('[Sales Register Summary] Owner store - including franchises:', storeIds);
      }

    const dateFilter = getDateRange(startDate, endDate);
    console.log('[Sales Register Summary] Date filter:', dateFilter);

    const sales = await fetchReportableSales(
      storeIds.length > 1 ? { in: storeIds } : storeIds[0],
      startDate,
      endDate,
      {
        include: {
          payments: true,
          items: {
            include: {
              product: { include: { category: true } },
            },
          },
        },
      }
    );

    const paymentStats: Record<string, { method: string; count: number; total: number }> = {};
    const masaleTotals = emptyMasaleSplit();

    for (const sale of sales) {
      const saleMasale = masaleTotalsFromSaleItems(sale.items);
      addToMasaleSplit(masaleTotals, {
        isMasale: true,
        revenue: saleMasale.masaleRevenue,
        qtyKg: saleMasale.masaleQtyKg,
        qtyPcs: saleMasale.masaleQtyPcs,
        lines: saleMasale.masaleLineCount,
      });
      addToMasaleSplit(masaleTotals, {
        isMasale: false,
        revenue: saleMasale.otherRevenue,
        qtyKg: saleMasale.otherQtyKg,
        qtyPcs: saleMasale.otherQtyPcs,
        lines: 0,
      });

      for (const payment of sale.payments) {
        if (!paymentStats[payment.method]) {
          paymentStats[payment.method] = {
            method: payment.method,
            count: 0,
            total: 0,
          };
        }
        paymentStats[payment.method].count += 1;
        // Round to 3 decimal places for consistency
        paymentStats[payment.method].total = Math.round((paymentStats[payment.method].total + payment.amount) * 1000) / 1000;
      }
    }

    // Round to 3 decimal places for consistency
    const totalSales = sales.length;
    const totalRevenue = Math.round(sales.reduce((sum: any, s: any) => sum + s.grandTotal, 0) * 1000) / 1000;
    const totalDiscount = Math.round(sales.reduce((sum: any, s: any) => sum + s.discountTotal, 0) * 1000) / 1000;
    const totalTax = Math.round(sales.reduce((sum: any, s: any) => sum + s.taxTotal, 0) * 1000) / 1000;

    return {
      period: {
        startDate: dateFilter.gte,
        endDate: dateFilter.lte,
      },
      summary: {
        totalSales,
        totalRevenue,
        totalDiscount,
        totalTax,
        netRevenue: totalRevenue - totalDiscount,
        masaleRevenue: masaleTotals.masaleRevenue,
        masaleQtyKg: masaleTotals.masaleQtyKg,
        masaleQtyPcs: masaleTotals.masaleQtyPcs,
        masaleLineCount: masaleTotals.masaleLineCount,
        otherRevenue: masaleTotals.otherRevenue,
      },
      paymentMethods: Object.values(paymentStats),
    };
    } catch (error: any) {
      console.error('Sales register summary error:', error);
      reply.code(500).send({ error: 'Failed to generate sales register summary', details: error.message });
    }
  });

  // Sales Sub Register (Detailed)
  fastify.get('/sales-sub-register', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      
      if (!user.storeId) {
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }

      // Get user's store
      const userStore = await prisma.store.findUnique({
        where: { id: user.storeId },
        select: { id: true, type: true, parentOwnerStoreId: true },
      });

      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      // For OWNER stores, include sales from all franchise stores
      let storeIds: string[] = [queryStoreId || user.storeId];
      if (userStore.type === 'OWNER' && (!queryStoreId || queryStoreId === 'all')) {
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: userStore.id,
          },
          select: { id: true },
        });
        storeIds = [userStore.id, ...franchises.map(f => f.id)];
        console.log('[Sales Sub Register] Owner store - including franchises:', storeIds);
      }

    const dateFilter = getDateRange(startDate, endDate);

    const sales = await fetchReportableSales(
      storeIds.length > 1 ? { in: storeIds } : storeIds[0],
      startDate,
      endDate,
      {
        include: {
          customer: true,
        items: {
          include: {
            product: { include: { category: true } },
          },
        },
        payments: true,
        createdBy: true,
      },
      orderBy: { createdAt: 'asc' },
      }
    );

    return sales.map((sale) => {
      const masale = masaleTotalsFromSaleItems(sale.items);
      return {
      date: sale.createdAt,
      saleNo: sale.saleNo,
      time: sale.createdAt.toLocaleTimeString(),
      customer: sale.customer?.name || 'Walk-in',
      items: sale.items.length,
      subTotal: sale.subTotal,
      discount: sale.discountTotal,
      tax: sale.taxTotal,
      total: sale.grandTotal,
      masaleRevenue: masale.masaleRevenue,
      masaleQtyPcs: masale.masaleQtyPcs,
      paymentMethod: sale.payments.map((p: any) => p.method).join(', '),
      cashier: sale.createdBy.name,
    };
    });
    } catch (error: any) {
      console.error('Sales sub register error:', error);
      reply.code(500).send({ error: 'Failed to generate sales sub register', details: error.message });
    }
  });

  // Bill Wise Sale Cancel
  fastify.get('/bill-wise-sale-cancel', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      const resolved = await resolveReportStoreIds(user, queryStoreId);
      if (!resolved) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

    const dateFilter = getDateRange(startDate, endDate);

    const cancelledSales = await prisma.sale.findMany({
      where: {
        storeId: resolved.storeIdWhere,
        status: 'VOID',
        createdAt: dateFilter,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
        createdBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return cancelledSales.map((sale) => ({
      saleId: sale.id,
      saleNo: sale.saleNo,
      date: sale.createdAt,
      customerName: sale.customer?.name || 'Walk-in',
      originalTotal: sale.grandTotal,
      itemsCount: sale.items.length,
      cancelledBy: sale.createdBy.name,
      items: sale.items.map((item: any) => ({
        productName: item.product.name,
        qty: item.qtyKg || item.qtyPcs || 0,
        amount: item.lineTotal,
      })),
    }));
    } catch (error: any) {
      console.error('Bill-wise sale cancel report error:', error);
      reply.code(500).send({ error: 'Failed to generate bill-wise sale cancel report', details: error.message });
    }
  });

  // PO Report
  fastify.get('/po-report', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      const resolved = await resolveReportStoreIds(user, queryStoreId);
      if (!resolved) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

    const dateFilter = getDateRange(startDate, endDate);

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        franchiseStoreId: resolved.storeIdWhere,
        createdAt: dateFilter,
      },
      include: {
        franchiseStore: {
          select: { name: true },
        },
        ownerStore: {
          select: { name: true },
        },
        items: {
          include: {
            product: true,
          },
        },
        dispatch: {
          include: {
            grn: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return purchaseOrders.map((po) => ({
      poId: po.id,
      poNo: po.poNo,
      date: po.createdAt,
      franchiseStore: po.franchiseStore.name,
      ownerStore: po.ownerStore.name,
      status: po.status,
      itemsCount: po.items.length,
      items: po.items.map((item: any) => ({
        productName: item.product.name,
        sku: item.product.sku,
        qtyKg: item.qtyKg,
        qtyPcs: item.qtyPcs,
        requestedRate: item.requestedRate,
      })),
      hasDispatch: !!po.dispatch,
      hasGRN: !!po.dispatch?.grn,
    }));
    } catch (error: any) {
      console.error('PO report error:', error);
      reply.code(500).send({ error: 'Failed to generate PO report', details: error.message });
    }
  });

  // Helper function to get store IDs for owner (all franchises or specific)
  async function getStoreIdsForOwner(ownerStoreId: string, queryStoreId?: string) {
    if (queryStoreId === 'all' || !queryStoreId) {
      // Get all franchises for owner
      const franchises = await prisma.store.findMany({
        where: {
          type: 'FRANCHISE',
          parentOwnerStoreId: ownerStoreId,
        },
        select: { id: true },
      });
      return [ownerStoreId, ...franchises.map(f => f.id)];
    } else {
      return [queryStoreId];
    }
  }

  // SKU Wise Sales Report
  fastify.get('/sku-wise-sales', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      
      // Get user's store
      const userStore = await prisma.store.findUnique({
        where: { id: user.storeId },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });

      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      const ownerStoreId = userStore.type === 'OWNER' ? userStore.id : userStore.parentOwnerStoreId;
      const userStoreId = queryStoreId || user.storeId;

    const dateFilter = getDateRange(startDate, endDate);

      // If owner and queryStoreId is 'all', get all franchise store IDs
      let storeIds = [userStoreId];
      if (userStore.type === 'OWNER' && (queryStoreId === 'all' || !queryStoreId)) {
        storeIds = await getStoreIdsForOwner(ownerStoreId, queryStoreId);
      }

    const sales = await fetchReportableSales({ in: storeIds }, startDate, endDate, {
      include: {
        items: {
          include: {
            product: { include: { category: true } },
          },
        },
      },
    });

    const skuStats: Record<string, any> = {};

    for (const sale of sales) {
      for (const item of sale.items) {
        if (!item.product) continue;
        const sku = item.product.sku;
        if (!skuStats[sku]) {
          skuStats[sku] = {
            sku: sku,
            productName: item.product.name,
            plu: item.product.plu,
            isMasale: isMasaleProduct(item.product.category?.name, item.product.name),
            qtyKg: 0,
            qtyPcs: 0,
            revenue: 0,
            salesCount: 0,
            avgPrice: 0,
          };
        }
        skuStats[sku].qtyKg = Math.round((skuStats[sku].qtyKg + (item.qtyKg || 0)) * 100) / 100;
        skuStats[sku].qtyPcs = Math.round(skuStats[sku].qtyPcs + (item.qtyPcs || 0));
        skuStats[sku].revenue = Math.round((skuStats[sku].revenue + item.lineTotal) * 1000) / 1000;
        skuStats[sku].salesCount += 1;
      }
    }

    // Calculate average price - Round to 3 decimal places
    Object.values(skuStats).forEach((stat: any) => {
      const totalQty = stat.qtyKg + stat.qtyPcs;
      stat.avgPrice = totalQty > 0 ? Math.round((stat.revenue / totalQty) * 1000) / 1000 : 0;
      // Also round the final revenue to 3 decimal places
      stat.revenue = Math.round(stat.revenue * 1000) / 1000;
    });

      return Object.values(skuStats).sort((a: any, b: any) => b.revenue - a.revenue);
    } catch (error: any) {
      console.error('SKU-wise sales report error:', error);
      reply.code(500).send({ error: 'Failed to generate SKU-wise sales report', details: error.message });
    }
  });

  // Summary Report
  fastify.get('/summary-report', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);

      const resolved = await resolveReportStoreIds(user, queryStoreId);
      if (!resolved) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }
      const { userStore, storeIdWhere } = resolved;
      const ownerStoreId = userStore.type === 'OWNER' ? userStore.id : userStore.parentOwnerStoreId;

    const dateFilter = getReportDateRange(startDate, endDate);

    const [sales, products, customers, inventoryMovements] = await Promise.all([
      fetchReportableSales(storeIdWhere, startDate, endDate, {
        include: {
          items: {
            include: {
              product: { include: { category: true } },
            },
          },
          payments: true,
        },
      }),
      prisma.product.count({
        where: {
          ownerStoreId: ownerStoreId || '',
          isActive: true,
        },
      }),
      prisma.customer.count({
        where: {
          storeId: storeIdWhere,
        },
      }),
      prisma.inventoryLedger.count({
        where: {
          storeId: storeIdWhere,
          createdAt: dateFilter,
        },
      }),
    ]);

    // Round to 3 decimal places for consistency
    const totalRevenue = Math.round(sales.reduce((sum: any, s: any) => sum + s.grandTotal, 0) * 1000) / 1000;
    const totalItemsSold = sales.reduce((sum: any, s: any) => sum + s.items.length, 0);
    const avgBillValue = sales.length > 0 ? Math.round((totalRevenue / sales.length) * 1000) / 1000 : 0;
    const masaleTotals = emptyMasaleSplit();
    for (const sale of sales) {
      const split = masaleTotalsFromSaleItems(sale.items);
      addToMasaleSplit(masaleTotals, {
        isMasale: true,
        revenue: split.masaleRevenue,
        qtyKg: split.masaleQtyKg,
        qtyPcs: split.masaleQtyPcs,
        lines: split.masaleLineCount,
      });
      addToMasaleSplit(masaleTotals, {
        isMasale: false,
        revenue: split.otherRevenue,
        qtyKg: split.otherQtyKg,
        qtyPcs: split.otherQtyPcs,
        lines: 0,
      });
    }

    const paymentBreakdown: Record<string, number> = {};
    sales.forEach((sale) => {
      sale.payments.forEach((payment: any) => {
        paymentBreakdown[payment.method] = Math.round(((paymentBreakdown[payment.method] || 0) + payment.amount) * 1000) / 1000;
      });
    });

    return {
      period: {
        startDate: dateFilter.gte,
        endDate: dateFilter.lte,
      },
      sales: {
        totalSales: sales.length,
        totalRevenue,
        totalItemsSold,
        avgBillValue,
        masaleRevenue: masaleTotals.masaleRevenue,
        masaleQtyKg: masaleTotals.masaleQtyKg,
        masaleQtyPcs: masaleTotals.masaleQtyPcs,
        masaleLineCount: masaleTotals.masaleLineCount,
        otherRevenue: masaleTotals.otherRevenue,
      },
      inventory: {
        totalProducts: products,
        totalMovements: inventoryMovements,
      },
      customers: {
        totalCustomers: customers,
      },
      payments: paymentBreakdown,
    };
    } catch (error: any) {
      console.error('Summary report error:', error);
      reply.code(500).send({ error: 'Failed to generate summary report', details: error.message });
    }
  });

  // Pending Report
  fastify.get('/pending', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { storeId: queryStoreId } = (request.query as any);
      const resolved = await resolveReportStoreIds(user, queryStoreId);
      if (!resolved) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

    const [pendingPOs, pendingDeliveries, openSales] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: {
          franchiseStoreId: resolved.storeIdWhere,
          status: {
            in: ['DRAFT', 'SUBMITTED', 'APPROVED'],
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      }),
      prisma.deliveryOrder.findMany({
        where: {
          storeId: resolved.storeIdWhere,
          status: {
            in: ['CREATED', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY'],
          },
        },
        include: {
          sale: {
            select: {
              saleNo: true,
              grandTotal: true,
            },
          },
        },
      }),
      prisma.sale.findMany({
        where: {
          storeId: resolved.storeIdWhere,
          status: 'OPEN',
        },
        include: {
          customer: true,
          items: true,
        },
      }),
    ]);

    return {
      pendingPurchaseOrders: pendingPOs.map((po) => ({
        poNo: po.poNo,
        status: po.status,
        itemsCount: po.items.length,
        createdAt: po.createdAt,
      })),
      pendingDeliveries: pendingDeliveries.map((delivery) => ({
        saleNo: delivery.sale.saleNo,
        status: delivery.status,
        amount: delivery.sale.grandTotal,
        createdAt: delivery.createdAt,
      })),
      openSales: openSales.map((sale) => ({
        saleNo: sale.saleNo,
        customer: sale.customer?.name || 'Walk-in',
        total: sale.grandTotal,
        itemsCount: sale.items.length,
        createdAt: sale.createdAt,
      })),
    };
    } catch (error: any) {
      console.error('Pending report error:', error);
      reply.code(500).send({ error: 'Failed to generate pending report', details: error.message });
    }
  });

  // MRN & Balance Confirmation
  fastify.get('/mrn-balance', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      const userStoreId = queryStoreId || user.storeId;
      
      // Get user's store
      const userStore = await prisma.store.findUnique({
        where: { id: user.storeId },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });

      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      const ownerStoreId = userStore.type === 'OWNER' ? userStore.id : userStore.parentOwnerStoreId;

    const grns = await prisma.gRN.findMany({
      where: {
        dispatch: {
          po: {
            franchiseStoreId: userStoreId,
          },
        },
      },
      include: {
        dispatch: {
          include: {
            po: {
              include: {
                franchiseStore: {
                  select: { id: true, name: true, type: true }
                },
                ownerStore: {
                  select: { id: true, name: true, type: true }
                },
              },
            },
            items: {
              include: {
                product: true,
              },
            },
          },
        },
        receiver: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
    });

      const products = await prisma.product.findMany({
        where: {
          ownerStoreId: ownerStoreId || '',
          isActive: true,
        },
      include: {
        inventoryLedgers: {
          where: { storeId: userStoreId },
        },
        storeProductPrices: {
          where: {
            storeId: userStoreId,
            isActive: true,
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
    });

    const balanceData = products.map((product: any) => {
      const inQty = product.inventoryLedgers
        .filter((l: any) => l.type === 'IN')
        .reduce((sum: any, l) => Math.round((sum + (l.qtyKg || 0) + (l.qtyPcs || 0)) * 100) / 100, 0);
      const outQty = product.inventoryLedgers
        .filter((l: any) => l.type === 'OUT')
        .reduce((sum: any, l) => Math.round((sum + (l.qtyKg || 0) + (l.qtyPcs || 0)) * 100) / 100, 0);
      const balance = Math.round((inQty - outQty) * 100) / 100;

      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        balance: balance > 0 ? balance : 0,
        unitType: product.unitType,
        price: product.storeProductPrices[0]?.pricePerUnit || 0,
        value: (balance > 0 ? balance : 0) * (product.storeProductPrices[0]?.pricePerUnit || 0),
      };
    });

    return {
      mrnList: grns.map((grn) => ({
        grnId: grn.id,
        dispatchNo: grn.dispatch.dispatchNo,
        poNo: grn.dispatch.po.poNo,
        receivedAt: grn.receivedAt,
        receivedBy: grn.receiver.name,
        status: grn.status,
        items: grn.dispatch.items.map((item: any) => ({
          productName: item.product.name,
          qtyKg: item.qtyKg,
          qtyPcs: item.qtyPcs,
        })),
      })),
      balanceConfirmation: balanceData,
    };
    } catch (error: any) {
      console.error('MRN balance report error:', error);
      reply.code(500).send({ error: 'Failed to generate MRN balance report', details: error.message });
    }
  });
}

