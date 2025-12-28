import { prisma } from '@azela-pos/db';
import type { ParsedBarcode } from '@azela-pos/shared';

export async function parseScaleBarcode(
  barcode: string,
  storeId: string,
  configId?: string
): Promise<ParsedBarcode | null> {
  // First, try to find by SKU (simple barcode)
  const productBySku = await prisma.product.findFirst({
    where: {
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

  if (productBySku) {
    return {
      productId: productBySku.id,
      plu: productBySku.plu,
      qtyPcs: 1,
      pricePerKg: productBySku.storeProductPrices[0]?.pricePerUnit || 0,
      lineTotal: productBySku.storeProductPrices[0]?.pricePerUnit || 0,
      raw: barcode,
    };
  }

  // Get scale barcode config
  let config;
  if (configId) {
    config = await prisma.scaleBarcodeConfig.findUnique({
      where: { id: configId },
    });
  } else {
    config = await prisma.scaleBarcodeConfig.findFirst({
      where: {
        storeId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!config) {
    return null;
  }

  // Validate prefix
  if (!barcode.startsWith(config.prefix)) {
    return null;
  }

  // Extract product identifier (PLU or Product ID/SKU)
  const productIdentifier = barcode.substring(
    config.prefix.length + config.pluStart,
    config.prefix.length + config.pluStart + config.pluLength
  );

  // Find product by PLU or SKU (product ID)
  const store = await prisma.store.findUnique({
    where: { id: storeId },
  });

  if (!store) {
    return null;
  }

  const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
  if (!ownerStoreId) {
    return null;
  }

  // Try to find product by PLU first, then by SKU (for numeric product IDs)
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

  // If not found by PLU, try SKU (for numeric product IDs like "00001")
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

  // Extract weight if encoded, otherwise calculate from price
  let weightKg: number;
  let pricePerKg = product.storeProductPrices[0]?.pricePerUnit || 0;
  let lineTotal: number;

  // Check if weight is encoded in barcode (weightLength must be > 0)
  const hasWeightEncoded = config.weightLength > 0 &&
                           (config.prefix.length + config.weightStart + config.weightLength) <= barcode.length;

  if (hasWeightEncoded) {
    // Extract weight from barcode
    const weightStr = barcode.substring(
      config.prefix.length + config.weightStart,
      config.prefix.length + config.weightStart + config.weightLength
    );
    const weightInt = parseInt(weightStr, 10);
    weightKg = weightInt / Math.pow(10, config.weightDecimal);
    lineTotal = weightKg * pricePerKg;
  } else {
    // Weight not encoded - will calculate from total price
    weightKg = 0; // Will be calculated below
    lineTotal = 0;
  }

  // Extract price if encoded
  if (config.priceStart !== undefined && config.priceLength && config.priceDecimal !== undefined) {
    const priceStr = barcode.substring(
      config.prefix.length + config.priceStart,
      config.prefix.length + config.priceStart + config.priceLength
    );
    const priceInt = parseInt(priceStr, 10);
    const encodedPrice = priceInt / Math.pow(10, config.priceDecimal);
    
    // If weight is not encoded, the price represents total price - calculate weight
    if (!hasWeightEncoded) {
      lineTotal = encodedPrice;
      if (pricePerKg > 0) {
        weightKg = encodedPrice / pricePerKg;
      } else {
        // If no unit price, can't calculate weight
        return null;
      }
    } else {
      // Weight is encoded, so price could be per-unit or total
      // Assume it's total price if weight is also encoded
      lineTotal = encodedPrice;
      if (weightKg > 0) {
        pricePerKg = encodedPrice / weightKg;
      }
    }
  } else if (!hasWeightEncoded) {
    // No price and no weight encoded - can't parse
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

