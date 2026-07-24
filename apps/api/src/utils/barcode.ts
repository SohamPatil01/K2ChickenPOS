import type { ScaleBarcodeConfig } from '@azela-pos/db';
import { prisma } from '@azela-pos/db';
import { normalizeBarcodeForLookup, type ParsedBarcode } from '@azela-pos/shared';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Clamp kg to a small number of decimals (avoids 0.5238095238… from price ÷ rate). */
function roundWeightKg(value: number, decimalPlaces: number): number {
  const places = Math.min(6, Math.max(2, decimalPlaces));
  const m = 10 ** places;
  return Math.round(value * m) / m;
}

/** Store IDs whose scale configs apply at this till: franchise store + parent owner (HQ). */
export function scaleBarcodeConfigScopeIdsFromStore(store: {
  id: string;
  type: string;
  parentOwnerStoreId: string | null;
}): string[] | null {
  const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
  if (!ownerStoreId) return null;
  return [...new Set([store.id, ownerStoreId])];
}

async function tryParseScaleBarcodeWithConfig(
  barcode: string,
  cleanBarcode: string,
  config: ScaleBarcodeConfig,
  ownerStoreId: string,
  storeId: string
): Promise<ParsedBarcode | null> {
  if (!cleanBarcode.startsWith(config.prefix) && !barcode.startsWith(config.prefix)) {
    return null;
  }

  const pluEnd = config.prefix.length + config.pluStart + config.pluLength;
  if (barcode.length < pluEnd) {
    return null;
  }

  const productIdentifier = barcode.substring(
    config.prefix.length + config.pluStart,
    pluEnd
  );

  let product = await prisma.product.findFirst({
    where: {
      ownerStoreId,
      plu: productIdentifier,
      isActive: true,
    },
    include: {
      storeProductPrices: {
        where: {
          storeId,
          isActive: true,
        },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
      },
    },
  });

  if (!product) {
    product = await prisma.product.findFirst({
      where: {
        ownerStoreId,
        sku: productIdentifier,
        isActive: true,
      },
      include: {
        storeProductPrices: {
          where: {
            storeId,
            isActive: true,
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
    });
  }

  if (!product) {
    return null;
  }

  let weightKg: number;
  let pricePerKg = product.storeProductPrices[0]?.pricePerUnit || 0;
  let lineTotal: number;

  const hasWeightEncoded =
    config.weightLength > 0 &&
    config.prefix.length + config.weightStart + config.weightLength <= barcode.length;

  if (hasWeightEncoded) {
    const weightStr = barcode.substring(
      config.prefix.length + config.weightStart,
      config.prefix.length + config.weightStart + config.weightLength
    );
    const weightInt = parseInt(weightStr, 10);
    weightKg = weightInt / Math.pow(10, config.weightDecimal);
    lineTotal = weightKg * pricePerKg;
  } else {
    weightKg = 0;
    lineTotal = 0;
  }

  if (config.priceStart !== undefined && config.priceLength && config.priceDecimal !== undefined) {
    const priceEnd = config.prefix.length + config.priceStart + config.priceLength;
    if (barcode.length < priceEnd) {
      return null;
    }
    const priceStr = barcode.substring(
      config.prefix.length + config.priceStart,
      priceEnd
    );
    const priceInt = parseInt(priceStr, 10);
    const encodedPrice = priceInt / Math.pow(10, config.priceDecimal);

    if (!hasWeightEncoded) {
      lineTotal = encodedPrice;
      if (pricePerKg > 0) {
        weightKg = encodedPrice / pricePerKg;
      } else {
        return null;
      }
    } else {
      lineTotal = encodedPrice;
      if (weightKg > 0) {
        pricePerKg = encodedPrice / weightKg;
      }
    }
  } else if (!hasWeightEncoded) {
    return null;
  }

  const weightPlaces = hasWeightEncoded
    ? Math.min(4, Math.max(2, config.weightDecimal))
    : Math.min(4, Math.max(3, config.weightDecimal));

  weightKg = roundWeightKg(weightKg, weightPlaces);
  lineTotal = roundMoney(lineTotal);
  if (weightKg > 0) {
    pricePerKg = roundMoney(lineTotal / weightKg);
  } else {
    pricePerKg = roundMoney(pricePerKg);
  }

  return {
    productId: product.id,
    plu: product.plu,
    weightKg,
    pricePerKg,
    lineTotal,
    raw: barcode,
  };
}

export async function fetchProductByWhitespaceNormalizedSkuPlu(
  ownerStoreId: string,
  storeId: string,
  barcode: string
) {
  const cleanBarcode = normalizeBarcodeForLookup(barcode);
  if (!cleanBarcode) return null;
  const id = await findProductIdByWhitespaceStrippedSkuPlu(ownerStoreId, cleanBarcode);
  if (!id) return null;
  return productWithPricesForStore(id, storeId);
}

async function productWithPricesForStore(productId: string, storeId: string) {
  return prisma.product.findFirst({
    where: { id: productId },
    include: {
      storeProductPrices: {
        where: {
          storeId,
          isActive: true,
        },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
      },
    },
  });
}

/** Match when DB SKU/PLU contains spaces (e.g. "8 906148 690207") but scan is compact. */
async function findProductIdByWhitespaceStrippedSkuPlu(
  ownerStoreId: string,
  cleanBarcode: string
): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Product"
    WHERE "ownerStoreId" = ${ownerStoreId}
      AND "isActive" = true
      AND (
        regexp_replace("sku", '[[:space:]]', '', 'g') = ${cleanBarcode}
        OR regexp_replace("plu", '[[:space:]]', '', 'g') = ${cleanBarcode}
      )
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

export async function parseScaleBarcode(
  barcode: string,
  storeId: string,
  configId?: string
): Promise<ParsedBarcode | null> {
  const cleanBarcode = normalizeBarcodeForLookup(barcode);

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, type: true, parentOwnerStoreId: true },
  });

  if (!store) {
    return null;
  }

  const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
  if (!ownerStoreId) {
    return null;
  }

  // Single indexed lookup for simple SKU/PLU (covers most scans).
  const skuOrPlu = [...new Set([cleanBarcode, barcode].filter(Boolean))];
  let productBySku = await prisma.product.findFirst({
    where: {
      ownerStoreId,
      isActive: true,
      OR: [
        { sku: { in: skuOrPlu } },
        { plu: { in: skuOrPlu } },
      ],
    },
    include: {
      storeProductPrices: {
        where: {
          storeId,
          isActive: true,
        },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
      },
    },
  });

  // Optional: SKUs stored with spaces in DB vs compact scan.
  if (!productBySku && cleanBarcode.length > 0) {
    const id = await findProductIdByWhitespaceStrippedSkuPlu(ownerStoreId, cleanBarcode);
    if (id) {
      productBySku = await productWithPricesForStore(id, storeId);
    }
  }

  if (productBySku) {
    const price = productBySku.storeProductPrices[0]?.pricePerUnit || 0;
    return {
      productId: productBySku.id,
      plu: productBySku.plu,
      qtyPcs: 1,
      pricePerKg: price,
      lineTotal: price,
      raw: barcode,
    };
  }

  const scopeIds = scaleBarcodeConfigScopeIdsFromStore(store);
  if (!scopeIds?.length) {
    return null;
  }

  if (configId) {
    const config = await prisma.scaleBarcodeConfig.findUnique({
      where: { id: configId },
    });
    if (!config?.isActive || !scopeIds.includes(config.storeId)) {
      return null;
    }
    return tryParseScaleBarcodeWithConfig(barcode, cleanBarcode, config, ownerStoreId, storeId);
  }

  const configs = await prisma.scaleBarcodeConfig.findMany({
    where: {
      storeId: { in: scopeIds },
      isActive: true,
    },
  });

  if (configs.length === 0) {
    return null;
  }

  const prefixMatches = configs.filter(
    (c) => cleanBarcode.startsWith(c.prefix) || barcode.startsWith(c.prefix)
  );

  prefixMatches.sort((a, b) => {
    const aLocal = a.storeId === storeId ? 0 : 1;
    const bLocal = b.storeId === storeId ? 0 : 1;
    if (aLocal !== bLocal) return aLocal - bLocal;
    if (b.prefix.length !== a.prefix.length) return b.prefix.length - a.prefix.length;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  for (const config of prefixMatches) {
    const parsed = await tryParseScaleBarcodeWithConfig(
      barcode,
      cleanBarcode,
      config,
      ownerStoreId,
      storeId
    );
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

