import { prisma } from '@azela-pos/db';
import {
  salesInStoreDayWhere,
  storeDayBoundsFromYmd,
  closingDateStorageKey,
  ymdInStoreTz,
  tallyPaymentsFromSales,
  tallyToClosingFields,
} from '@azela-pos/shared';

interface DailyClosingValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/** Auto daily closing for cron — uses the same fields as the manual daily-closing API. */
export class DailyClosingService {
  async generateDailyClosing(storeId: string, closingDate: Date): Promise<any> {
    const closingDateStr = ymdInStoreTz(closingDate);
    const closingDateObj = closingDateStorageKey(closingDateStr);
    const { gte: dayStart, lte: dayEnd } = storeDayBoundsFromYmd(closingDateStr);

    const existing = await prisma.dailyClosing.findUnique({
      where: {
        storeId_closingDate: { storeId, closingDate: closingDateObj },
      },
    });

    if (existing?.isFinalized) {
      return { success: false, message: 'Daily closing already finalized', data: existing };
    }

    const closer = await prisma.user.findFirst({
      where: {
        storeId,
        role: { in: ['MANAGER', 'OWNER'] },
        isActive: true,
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!closer) {
      return { success: false, message: 'No active manager/owner found for store' };
    }

    const summary = await this.calculateDailySummary(storeId, closingDateStr, dayStart, dayEnd);
    const validation = this.validateClosing(summary);
    if (!validation.isValid) {
      return { success: false, message: 'Validation failed', errors: validation.errors };
    }

    const previousDate = new Date(closingDateObj);
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);
    const previousClosing = await prisma.dailyClosing.findUnique({
      where: {
        storeId_closingDate: { storeId, closingDate: previousDate },
      },
    });

    const openingCash = previousClosing?.closingCash ?? 0;
    const cashReceived = summary.cashSales;
    const cashExpected = Math.round((openingCash + cashReceived) * 1000) / 1000;
    const closingCash = cashExpected;
    const cashDifference = 0;

    const dailyClosing = await prisma.dailyClosing.upsert({
      where: {
        storeId_closingDate: { storeId, closingDate: closingDateObj },
      },
      update: {
        openingCash,
        cashSales: summary.cashSales,
        cardSales: summary.cardSales,
        upiSales: summary.upiSales,
        cashReceived,
        cashExpected,
        cashDifference,
        closingCash,
        totalWeightSoldKg: summary.totalWeightSoldKg,
        totalWastageKg: summary.totalWastageKg,
        totalSales: summary.totalSales,
        totalRevenue: summary.totalRevenue,
        totalDiscounts: summary.totalDiscounts,
        totalTax: summary.totalTax,
        notes: 'Auto-generated at 8 PM',
      },
      create: {
        storeId,
        closingDate: closingDateObj,
        closedBy: closer.id,
        openingCash,
        cashSales: summary.cashSales,
        cardSales: summary.cardSales,
        upiSales: summary.upiSales,
        cashReceived,
        cashExpected,
        cashDifference,
        closingCash,
        totalWeightSoldKg: summary.totalWeightSoldKg,
        totalWastageKg: summary.totalWastageKg,
        totalSales: summary.totalSales,
        totalRevenue: summary.totalRevenue,
        totalDiscounts: summary.totalDiscounts,
        totalTax: summary.totalTax,
        notes: 'Auto-generated at 8 PM',
      },
    });

    return {
      success: true,
      data: dailyClosing,
      warnings: validation.warnings,
    };
  }

  private async calculateDailySummary(
    storeId: string,
    closingDateStr: string,
    startDate: Date,
    endDate: Date
  ) {
    const sales = await prisma.sale.findMany({
      where: salesInStoreDayWhere(storeId, closingDateStr, 'PAID') as any,
      include: {
        items: { include: { product: true } },
        payments: true,
      },
    });

    const totalSales = sales.length;
    const totalRevenue =
      Math.round(sales.reduce((sum, sale) => sum + (sale.grandTotal || 0), 0) * 1000) / 1000;
    const totalDiscounts =
      Math.round(sales.reduce((sum, sale) => sum + (sale.discountTotal || 0), 0) * 1000) / 1000;
    const totalTax =
      Math.round(sales.reduce((sum, sale) => sum + (sale.taxTotal || 0), 0) * 1000) / 1000;

    const totalWeightSoldKg =
      Math.round(
        sales.reduce((sum, sale) => {
          return (
            sum +
            (sale.items?.reduce((itemSum, item) => {
              if (item.product?.unitType === 'KG') {
                return itemSum + (item.qtyKg || 0);
              }
              return itemSum;
            }, 0) || 0)
          );
        }, 0) * 100
      ) / 100;

    const wastageLedgers = await prisma.inventoryLedger.findMany({
      where: {
        storeId,
        reason: 'WASTAGE',
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const totalWastageKg =
      Math.round(
        wastageLedgers.reduce(
          (sum, ledger) => sum + (ledger.qtyKg || 0) + (ledger.qtyPcs || 0),
          0
        ) * 100
      ) / 100;

    const paymentTotals = tallyPaymentsFromSales(sales);
    const { cashSales, cardSales, upiSales } = tallyToClosingFields(paymentTotals);

    return {
      totalSales,
      totalRevenue,
      totalDiscounts,
      totalTax,
      totalWeightSoldKg,
      totalWastageKg,
      cashSales,
      cardSales,
      upiSales,
    };
  }

  private validateClosing(summary: {
    totalRevenue: number;
    totalSales: number;
    cashSales: number;
    totalWastageKg: number;
    totalWeightSoldKg: number;
    totalDiscounts: number;
  }): DailyClosingValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (summary.totalRevenue < 0) {
      errors.push('Total revenue cannot be negative');
    }
    if (summary.totalSales === 0) {
      warnings.push('No sales recorded for the day');
    }
    if (summary.cashSales > summary.totalRevenue * 0.9 && summary.totalRevenue > 0) {
      warnings.push('High cash sales percentage (>90%)');
    }
    if (
      summary.totalWastageKg > summary.totalWeightSoldKg * 0.1 &&
      summary.totalWeightSoldKg > 0
    ) {
      warnings.push('High wastage detected (>10% of sales)');
    }
    if (summary.totalDiscounts > summary.totalRevenue * 0.2 && summary.totalRevenue > 0) {
      warnings.push('High discount amount (>20% of revenue)');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  async getStoresForAutoClosing(): Promise<string[]> {
    const stores = await prisma.store.findMany({
      where: { type: { in: ['FRANCHISE', 'OWNER'] } },
      select: { id: true },
    });
    return stores.map((s) => s.id);
  }
}

export const dailyClosingService = new DailyClosingService();
