import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  const barcode = '8906148690207';
  console.log('Checking masale barcode:', barcode);
  console.log('');

  // Get all stores
  const stores = await prisma.store.findMany({
    where: { type: 'OWNER' },
    select: { id: true, name: true },
  });

  if (stores.length === 0) {
    console.log('❌ No owner stores found');
    return;
  }

  const ownerStore = stores[0];
  console.log(`Checking for store: ${ownerStore.name} (${ownerStore.id})\n`);

  // Check product
  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { sku: barcode },
        { plu: barcode }
      ],
    },
    include: {
      category: true,
      storeProductPrices: {
        where: { isActive: true },
        orderBy: { effectiveFrom: 'desc' },
      },
    },
  });

  if (!product) {
    console.log('❌ Product not found with barcode:', barcode);
    console.log('\nLet me check if product exists with different barcode...\n');
    
    const masaleProducts = await prisma.product.findMany({
      where: {
        name: { contains: 'Masala', mode: 'insensitive' },
      },
      take: 10,
    });

    if (masaleProducts.length > 0) {
      console.log('Found masale products:');
      masaleProducts.forEach(p => {
        console.log(`  - ${p.name}: SKU=${p.sku}, PLU=${p.plu}, Active=${p.isActive}`);
      });
    }
    return;
  }

  console.log('✅ Product found:');
  console.log(`  Name: ${product.name}`);
  console.log(`  SKU: ${product.sku}`);
  console.log(`  PLU: ${product.plu}`);
  console.log(`  Category: ${product.category?.name || 'N/A'}`);
  console.log(`  Active: ${product.isActive}`);
  console.log(`  Owner Store ID: ${product.ownerStoreId}`);
  console.log('');

  // Check prices for all stores
  console.log('Price Information:');
  const allStores = await prisma.store.findMany({
    select: { id: true, name: true, type: true },
  });

  for (const store of allStores) {
    const price = await prisma.storeProductPrice.findFirst({
      where: {
        storeId: store.id,
        productId: product.id,
        isActive: true,
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (price) {
      console.log(`  ✅ ${store.name} (${store.type}): ₹${price.pricePerUnit}`);
    } else {
      console.log(`  ❌ ${store.name} (${store.type}): No price set`);
    }
  }

  console.log('');

  // Test barcode lookup for each store
  console.log('Testing barcode lookup:');
  for (const store of allStores) {
    // Simulate the barcode lookup logic
    const productBySku = await prisma.product.findFirst({
      where: {
        sku: barcode,
        isActive: true,
      },
      include: {
        storeProductPrices: {
          where: {
            storeId: store.id,
            isActive: true,
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
    });

    if (productBySku && productBySku.storeProductPrices.length > 0) {
      console.log(`  ✅ ${store.name}: Will work (has price)`);
    } else if (productBySku) {
      console.log(`  ⚠️  ${store.name}: Product found but NO PRICE SET`);
    } else {
      console.log(`  ❌ ${store.name}: Product not found or inactive`);
    }
  }

  console.log('');

  // Check if we need to add prices
  const storesWithoutPrice = [];
  for (const store of allStores) {
    const price = await prisma.storeProductPrice.findFirst({
      where: {
        storeId: store.id,
        productId: product.id,
        isActive: true,
      },
    });

    if (!price) {
      storesWithoutPrice.push(store);
    }
  }

  if (storesWithoutPrice.length > 0) {
    console.log('⚠️  Stores without price (barcode won\'t work for these):');
    storesWithoutPrice.forEach(store => {
      console.log(`  - ${store.name} (${store.id})`);
    });
    console.log('');
    console.log('To fix: Run the script to add prices for all stores');
  }
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

