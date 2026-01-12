import { prisma } from '@azela-pos/db';
import type { ParsedBarcode } from '@azela-pos/shared';

export async function parseScaleBarcode(
  barcode: string,
  storeId: string,
  configId?: string
): Promise<ParsedBarcode | null> {
  // Clean barcode (remove spaces, trim)
  const cleanBarcode = barcode.trim().replace(/\s/g, '');
  
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

  // If no config exists, return null (product not found by SKU and no scale config)
  if (!config) {
    return null;
  }

  // IMPORTANT: Only try scale barcode parsing if barcode starts with the config prefix
  // This prevents masale/EAN-13 barcodes (starting with 8 or 9) from being parsed as scale barcodes
  if (!cleanBarcode.startsWith(config.prefix) && !barcode.startsWith(config.prefix)) {
    // Barcode doesn't match scale format - return null
    // This is a standard product barcode that should be looked up by SKU
    // If we got here, SKU lookup already failed, so product doesn't exist
    return null;
  }

  // Extract product identifier (PLU or Product ID/SKU)
  const productIdentifier = barcode.substring(
    config.prefix.length + config.pluStart,
    config.prefix.length + config.pluStart + config.pluLength
  );

  // Note: store and ownerStoreId are already defined above from SKU lookup
  // Reuse them here for scale barcode parsing

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

