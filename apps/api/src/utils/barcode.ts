import type { ScaleBarcodeConfig } from '@prisma/client';
import { prisma } from '@azela-pos/db';
import { normalizeBarcodeForLookup, type ParsedBarcode } from '@azela-pos/shared';

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
  
  // Get store to find ownerStoreId
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

  // First, try to find by SKU (simple barcode) - try both original and cleaned
  // Search within the owner store's products
  // Note: We search by ownerStoreId to find products, but prices are filtered by storeId
  let productBySku = await prisma.product.findFirst({
    where: {
      ownerStoreId,
      sku: cleanBarcode,
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
  
  // Debug logging
  if (!productBySku) {
    console.log(`[Barcode] SKU lookup failed - checking if product exists without ownerStoreId filter...`);
    const productWithoutFilter = await prisma.product.findFirst({
      where: {
        sku: cleanBarcode,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        ownerStoreId: true,
      },
    });
    
    if (productWithoutFilter) {
      console.log(`[Barcode] Product exists but ownerStoreId mismatch:`);
      console.log(`  Product ownerStoreId: ${productWithoutFilter.ownerStoreId}`);
      console.log(`  Expected ownerStoreId: ${ownerStoreId}`);
      console.log(`  Match: ${productWithoutFilter.ownerStoreId === ownerStoreId ? 'YES' : 'NO'}`);
    }
  }

  // If not found with cleaned barcode, try original
  if (!productBySku && cleanBarcode !== barcode) {
    productBySku = await prisma.product.findFirst({
      where: {
        ownerStoreId,
        sku: barcode,
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

  // Also try PLU
  if (!productBySku) {
    productBySku = await prisma.product.findFirst({
      where: {
        ownerStoreId,
        plu: cleanBarcode,
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

  if (!productBySku && cleanBarcode.length > 0) {
    const id = await findProductIdByWhitespaceStrippedSkuPlu(ownerStoreId, cleanBarcode);
    if (id) {
      productBySku = await productWithPricesForStore(id, storeId);
    }
  }
  
  // Fallback: If still not found, try without ownerStoreId filter (for products that might be shared)
  // This is a safety net in case ownerStoreId doesn't match
  if (!productBySku) {
    console.log(`[Barcode] Trying lookup without ownerStoreId filter as fallback...`);
    productBySku = await prisma.product.findFirst({
      where: {
        OR: [
          { sku: cleanBarcode },
          { plu: cleanBarcode }
        ],
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

    if (!productBySku && cleanBarcode.length > 0) {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Product"
        WHERE "isActive" = true
          AND (
            regexp_replace("sku", '[[:space:]]', '', 'g') = ${cleanBarcode}
            OR regexp_replace("plu", '[[:space:]]', '', 'g') = ${cleanBarcode}
          )
        LIMIT 1
      `;
      if (rows[0]) {
        productBySku = await productWithPricesForStore(rows[0].id, storeId);
      }
    }
    
    if (productBySku) {
      console.log(`[Barcode] Found product without ownerStoreId filter - ownerStoreId: ${productBySku.ownerStoreId}, expected: ${ownerStoreId}`);
      // Verify the product's ownerStoreId matches or is related
      const productOwnerStore = await prisma.store.findUnique({
        where: { id: productBySku.ownerStoreId },
        select: { id: true, type: true, parentOwnerStoreId: true },
      });
      
      if (productOwnerStore) {
        const productOwnerStoreId = productOwnerStore.type === 'OWNER' 
          ? productOwnerStore.id 
          : productOwnerStore.parentOwnerStoreId;
        
        if (productOwnerStoreId === ownerStoreId) {
          console.log(`[Barcode] Product ownerStoreId is valid (franchise store's owner matches)`);
        } else {
          console.log(`[Barcode] WARNING: Product ownerStoreId doesn't match expected owner`);
        }
      }
    }
  }

  if (productBySku) {
    const price = productBySku.storeProductPrices[0]?.pricePerUnit || 0;
    // Log for debugging (can be removed in production)
    console.log(`[Barcode] Found product by SKU/PLU: ${productBySku.name} (${productBySku.sku}), price: ${price}`);
    return {
      productId: productBySku.id,
      plu: productBySku.plu,
      qtyPcs: 1,
      pricePerKg: price,
      lineTotal: price,
      raw: barcode,
    };
  }
  
  // Log if not found (for debugging)
  console.log(`[Barcode] Product not found by SKU/PLU: ${cleanBarcode}, ownerStoreId: ${ownerStoreId}, storeId: ${storeId}`);

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

