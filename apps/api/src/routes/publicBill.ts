// @ts-nocheck
import { FastifyInstance, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';

/**
 * Public (no-auth) digital bill lookup. The sale id is a cuid (effectively
 * unguessable), so customers can open their bill by scanning a QR that links to
 * /bill/<saleId> without logging in. Returns only safe, display-oriented fields.
 *
 * No schema changes: reads existing sale/customer/store/loyalty data only.
 */
export async function publicBillRoutes(fastify: FastifyInstance) {
  fastify.get('/bill/:saleId', async (request: any, reply: FastifyReply) => {
    try {
      const { saleId } = request.params as any;
      if (!saleId || typeof saleId !== 'string') {
        reply.code(400).send({ error: 'Invalid bill reference' });
        return;
      }

      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          items: {
            include: { product: { select: { name: true, unitType: true } } },
          },
          payments: { select: { method: true, amount: true } },
          customer: { select: { name: true, phone: true, loyaltyPoints: true } },
          store: { select: { name: true } },
          loyaltyTransactions: {
            where: { type: 'EARN' },
            select: { points: true },
          },
        },
      });

      if (!sale) {
        reply.code(404).send({ error: 'Bill not found' });
        return;
      }

      // Mask the customer's phone (privacy) — show only last 4 digits.
      const maskedPhone = sale.customer?.phone
        ? `••••••${String(sale.customer.phone).slice(-4)}`
        : null;

      const items = sale.items.map((it: any) => {
        const meta = (it.metaJson as any) || {};
        const name =
          it.product?.name || meta.description || meta.name || 'Item';
        const isKg = (it.qtyKg ?? 0) > 0;
        const qtyValue = isKg ? it.qtyKg : it.qtyPcs || 0;
        const unit = isKg ? 'kg' : 'pcs';
        return {
          name,
          qty: qtyValue,
          unit,
          qtyLabel: `${qtyValue} ${unit}`,
          rate: it.rate,
          lineTotal: it.lineTotal,
          taxRate: it.taxRate,
        };
      });

      const loyaltyEarned = (sale.loyaltyTransactions || []).reduce(
        (sum: number, t: any) => sum + Math.max(0, t.points || 0),
        0
      );

      const payments = sale.payments || [];
      const paidAmount = payments
        .filter((p: any) => String(p.method || '').toUpperCase() !== 'CREDIT')
        .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const pendingAmount = Math.max(0, Math.round(Number(sale.grandTotal) - paidAmount));

      reply.header('Cache-Control', 'public, max-age=60');
      return {
        saleNo: sale.saleNo,
        status: sale.status,
        createdAt: sale.createdAt,
        storeName: sale.store?.name || null,
        customerName: sale.customer?.name || null,
        customerPhone: maskedPhone,
        items,
        subTotal: sale.subTotal,
        discountTotal: sale.discountTotal,
        taxTotal: sale.taxTotal,
        deliveryFee: sale.deliveryFee || 0,
        grandTotal: sale.grandTotal,
        payments,
        paidAmount,
        pendingAmount,
        loyaltyEarned,
        loyaltyBalance: sale.customer ? sale.customer.loyaltyPoints || 0 : null,
      };
    } catch (error: any) {
      console.error('Failed to load public bill:', error);
      reply.code(500).send({ error: 'Failed to load bill' });
    }
  });
}
