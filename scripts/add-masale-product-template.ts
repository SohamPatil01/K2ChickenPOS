import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

interface MasaleProduct {
  name: string;
  barcode: string; // EAN-13 barcode from package
  price: number;   // Price per piece
}

async function main() {
  console.log('Adding Masale Products\n');

  // Get owner store
  const ownerStore = await prisma.store.findFirst({ 
    where: { type: 'OWNER' },
    select: { id: true, name: true }
  });

  if (!ownerStore) {
    console.error('❌ Owner store not found');
    process.exit(1);
  }

  console.log(`✓ Found owner store: ${ownerStore.name}\n`);

  // Get or create "Spices" category
  let category = await prisma.category.findFirst({
    where: { 
      ownerStoreId: ownerStore.id, 
      name: { equals: 'Spices', mode: 'insensitive' }
    },
  });

  if (!category) {
    category = await prisma.category.create({
      data: {
        ownerStoreId: ownerStore.id,
        name: 'Spices',
        sortOrder: 100,
      },
    });
    console.log(`✓ Created category: Spices\n`);
  } else {
    console.log(`✓ Using category: ${category.name}\n`);
  }

  // ADD YOUR MASALE PRODUCTS HERE
  // Format: { name: "Product Name", barcode: "1234567890123", price: 30 }
  const masaleProducts: MasaleProduct[] = [
    { name: 'Mutton Rassa Masala', barcode: '8906148690207', price: 30 },
    // Add more masale products here:
    // { name: 'Chicken Masala', barcode: '8906148690208', price: 35 },
    // { name: 'Biryani Masala', barcode: '8906148690209', price: 40 },
  ];

  if (masaleProducts.length === 0) {
    console.log('⚠ No products to add. Edit this script and add products to the masaleProducts array.\n');
    return;
  }

  console.log(`Adding ${masaleProducts.length} masale product(s)...\n`);

  for (const productData of masaleProducts) {
    // Clean barcode (remove spaces)
    const barcode = productData.barcode.replace(/\s/g, '');
    const plu = barcode; // Use barcode as PLU too

    // Check if product already exists
    const existing = await prisma.product.findFirst({
      where: {
        ownerStoreId: ownerStore.id,
        OR: [
          { sku: barcode },
          { plu: plu }
        ]
      },
    });

    if (existing) {
      console.log(`⚠ ${productData.name} already exists (SKU: ${existing.sku})`);
      
      // Update price if different
      const currentPrice = await prisma.storeProductPrice.findFirst({
        where: {
          storeId: ownerStore.id,
          productId: existing.id,
          isActive: true,
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (currentPrice?.pricePerUnit !== productData.price) {
        // Deactivate old price
        await prisma.storeProductPrice.updateMany({
          where: {
            storeId: ownerStore.id,
            productId: existing.id,
            isActive: true,
          },
          data: { isActive: false },
        });

        // Create new price
        await prisma.storeProductPrice.create({
          data: {
            storeId: ownerStore.id,
            productId: existing.id,
            pricePerUnit: productData.price,
            isActive: true,
          },
        });

        console.log(`  ✓ Updated price to ₹${productData.price}/piece\n`);
      } else {
        console.log(`  ✓ Price already correct (₹${productData.price}/piece)\n`);
      }
      continue;
    }

    // Create product
    console.log(`Creating: ${productData.name}`);
    console.log(`  Barcode: ${barcode}`);
    console.log(`  Price: ₹${productData.price}/piece`);

    const product = await prisma.product.create({
      data: {
        ownerStoreId: ownerStore.id,
        sku: barcode,
        plu: plu,
        name: productData.name,
        categoryId: category.id,
        unitType: 'PCS',
        taxRate: 0,
        isActive: true,
      },
    });

    // Create price
    await prisma.storeProductPrice.create({
      data: {
        storeId: ownerStore.id,
        productId: product.id,
        pricePerUnit: productData.price,
        isActive: true,
      },
    });

    console.log(`  ✓ Created successfully!\n`);
  }

  console.log('✅ All masale products processed!\n');
  console.log('📝 Note: No barcode configuration needed for masale products.');
  console.log('   The system automatically looks up products by barcode (SKU).');
  console.log('   Just scan the barcode and it will work!');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

