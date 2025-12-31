import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { PrismaClient } from '@prisma/client';

// Load .env file from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Adding products and barcode configuration...');

  // Get owner store
  const ownerStore = await prisma.store.findFirst({ where: { type: 'OWNER' } });
  if (!ownerStore) {
    console.error('Owner store not found');
    process.exit(1);
  }

  // Get or create a category (use existing or create "Chicken Cuts")
  let category = await prisma.category.findFirst({
    where: { ownerStoreId: ownerStore.id, name: 'Chicken Cuts' },
  });

  if (!category) {
    category = await prisma.category.create({
      data: {
        ownerStoreId: ownerStore.id,
        name: 'Chicken Cuts',
        sortOrder: 1,
      },
    });
  }

  // Products list with rates
  const products = [
    { name: 'Hot Tandoor', rate: 320, sku: '00001', plu: '00001' },
    { name: 'Breast Boneless', rate: 460, sku: '00002', plu: '00002' },
    { name: 'Leg', rate: 360, sku: '00003', plu: '00003' },
    { name: 'Drumstick', rate: 400, sku: '00004', plu: '00004' },
    { name: 'Lollipop', rate: 400, sku: '00005', plu: '00005' },
    { name: 'Liver', rate: 160, sku: '00006', plu: '00006' },
    { name: 'Carcus', rate: 90, sku: '00007', plu: '00007' },
    { name: 'Egg', rate: 90, sku: '00008', plu: '00008' },
    { name: 'Gizzard', rate: 160, sku: '00009', plu: '00009' }, // Using liver rate as default
  ];

  console.log(`Creating ${products.length} products...`);

  for (const productData of products) {
    // Check if product already exists
    const existing = await prisma.product.findFirst({
      where: {
        ownerStoreId: ownerStore.id,
        OR: [{ sku: productData.sku }, { plu: productData.plu }],
      },
    });

    if (existing) {
      console.log(`Product ${productData.name} (${productData.sku}) already exists, updating...`);
      
      // Update product
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: productData.name,
          isActive: true,
        },
      });

      // Update or create price for owner store
      const existingPrice = await prisma.storeProductPrice.findFirst({
        where: {
          storeId: ownerStore.id,
          productId: existing.id,
          isActive: true,
        },
      });

      if (existingPrice) {
        // Deactivate old price
        await prisma.storeProductPrice.update({
          where: { id: existingPrice.id },
          data: { isActive: false },
        });
      }

      // Create new price
      await prisma.storeProductPrice.create({
        data: {
          storeId: ownerStore.id,
          productId: existing.id,
          pricePerUnit: productData.rate,
          isActive: true,
        },
      });

      console.log(`✅ Updated ${productData.name} - Rate: ₹${productData.rate}/kg`);
    } else {
      // Create new product
      const product = await prisma.product.create({
        data: {
          ownerStoreId: ownerStore.id,
          sku: productData.sku,
          plu: productData.plu,
          name: productData.name,
          categoryId: category.id,
          unitType: 'KG',
          taxRate: 0,
          isActive: true,
        },
      });

      // Create price for owner store
      await prisma.storeProductPrice.create({
        data: {
          storeId: ownerStore.id,
          productId: product.id,
          pricePerUnit: productData.rate,
          isActive: true,
        },
      });

      console.log(`✅ Created ${productData.name} (${productData.sku}) - Rate: ₹${productData.rate}/kg`);
    }
  }

  // Create barcode configuration (if not exists)
  const existingConfig = await prisma.scaleBarcodeConfig.findFirst({
    where: {
      storeId: ownerStore.id,
      isActive: true,
    },
  });

  if (!existingConfig) {
    await prisma.scaleBarcodeConfig.create({
      data: {
        storeId: ownerStore.id,
        name: 'Machine Barcode Format',
        prefix: '20',
        pluStart: 0,
        pluLength: 5,
        weightStart: 0,
        weightLength: 0, // Weight not encoded, will be calculated
        weightDecimal: 2,
        priceStart: 5,
        priceLength: 5,
        priceDecimal: 2,
        checksumType: 'NONE',
        isActive: true,
      },
    });
    console.log('✅ Created barcode configuration');
  } else {
    console.log('✅ Barcode configuration already exists');
  }

  // Update inventory - add initial stock for new products
  console.log('\nAdding initial inventory stock...');
  
  // Get all the products we just created/updated
  const productMap = new Map();
  for (const productData of products) {
    const product = await prisma.product.findFirst({
      where: {
        ownerStoreId: ownerStore.id,
        OR: [{ sku: productData.sku }, { plu: productData.plu }],
      },
    });
    if (product) {
      productMap.set(productData.sku, { product, rate: productData.rate });
    }
  }

  // Add initial stock (10kg for each product as starting inventory)
  for (const [sku, { product, rate }] of productMap) {
    // Check if there's already inventory for this product
    const existingStock = await prisma.inventoryLedger.findFirst({
      where: {
        storeId: ownerStore.id,
        productId: product.id,
        type: 'IN',
      },
    });

    if (!existingStock) {
      // Create initial inventory entry (10kg opening stock)
      await prisma.inventoryLedger.create({
        data: {
          storeId: ownerStore.id,
          productId: product.id,
          type: 'IN',
          reason: 'ADJUSTMENT',
          qtyKg: 10.0, // Initial stock of 10kg
        },
      });
      console.log(`  ✅ Added 10kg initial stock for ${product.name}`);
    } else {
      console.log(`  ℹ️  ${product.name} already has inventory entries`);
    }
  }

  console.log('\n✅ All products and barcode configuration added successfully!');
  console.log('\nProducts Summary:');
  for (const productData of products) {
    console.log(`  ${productData.sku} - ${productData.name}: ₹${productData.rate}/kg`);
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

