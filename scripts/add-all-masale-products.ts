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
  barcode: string; // May have spaces
  price: number;
}

async function main() {
  console.log('Adding All Masale Products\n');

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

  // All masale products
  const masaleProducts: MasaleProduct[] = [
    { name: 'Waradi Mutton Rassa Masale', barcode: '8 906148 690290', price: 30 },
    { name: 'Kolhapuri Chicken Rassa Masala', barcode: '8 906148 690061', price: 30 },
    { name: 'Kolhapuri Chicken Sukka Masala', barcode: '8 906148 690054', price: 30 },
    { name: 'Malvani Chicken Rassa Masala', barcode: '8 906148 690214', price: 30 },
    { name: 'Kolhapuri Chicken Biryani Masala', barcode: '8 906148 690030', price: 30 },
  ];

  console.log(`Adding ${masaleProducts.length} masale product(s)...\n`);

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (const productData of masaleProducts) {
    try {
      // Clean barcode (remove spaces)
      const cleanBarcode = productData.barcode.replace(/\s/g, '');
      const plu = cleanBarcode; // Use barcode as PLU too

      console.log(`Processing: ${productData.name}`);
      console.log(`  Barcode: ${productData.barcode} → ${cleanBarcode}`);
      console.log(`  Price: ₹${productData.price}/piece`);

      // Check if product already exists
      const existing = await prisma.product.findFirst({
        where: {
          ownerStoreId: ownerStore.id,
          OR: [
            { sku: cleanBarcode },
            { plu: cleanBarcode },
            { sku: productData.barcode }, // Also check with spaces
            { plu: productData.barcode },
          ]
        },
      });

      if (existing) {
        console.log(`  ⚠️  Product already exists (SKU: ${existing.sku})`);
        
        // Update name if different
        if (existing.name !== productData.name) {
          await prisma.product.update({
            where: { id: existing.id },
            data: { name: productData.name },
          });
          console.log(`  ✓ Updated name to: ${productData.name}`);
        }

        // Check and update price for all stores
        const allStores = await prisma.store.findMany({
          select: { id: true, name: true },
        });

        for (const store of allStores) {
          const existingPrice = await prisma.storeProductPrice.findFirst({
            where: {
              storeId: store.id,
              productId: existing.id,
              isActive: true,
            },
            orderBy: { effectiveFrom: 'desc' },
          });

          if (!existingPrice || existingPrice.pricePerUnit !== productData.price) {
            // Deactivate old price
            if (existingPrice) {
              await prisma.storeProductPrice.updateMany({
                where: {
                  storeId: store.id,
                  productId: existing.id,
                  isActive: true,
                },
                data: { isActive: false },
              });
            }

            // Create new price
            await prisma.storeProductPrice.create({
              data: {
                storeId: store.id,
                productId: existing.id,
                pricePerUnit: productData.price,
                isActive: true,
              },
            });

            console.log(`  ✓ Updated price for ${store.name}: ₹${productData.price}`);
          }
        }

        results.updated++;
        console.log(`  ✅ Updated successfully!\n`);
        continue;
      }

      // Create new product
      const product = await prisma.product.create({
        data: {
          ownerStoreId: ownerStore.id,
          sku: cleanBarcode,
          plu: plu,
          name: productData.name,
          categoryId: category.id,
          unitType: 'PCS',
          taxRate: 0,
          isActive: true,
        },
      });

      console.log(`  ✓ Created product: ${product.name} (ID: ${product.id})`);

      // Create prices for all stores
      const allStores = await prisma.store.findMany({
        select: { id: true, name: true },
      });

      for (const store of allStores) {
        await prisma.storeProductPrice.create({
          data: {
            storeId: store.id,
            productId: product.id,
            pricePerUnit: productData.price,
            isActive: true,
          },
        });
        console.log(`  ✓ Added price for ${store.name}: ₹${productData.price}`);
      }

      results.created++;
      console.log(`  ✅ Created successfully!\n`);

    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}\n`);
      results.errors.push(`${productData.name}: ${error.message}`);
      results.skipped++;
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`✅ Created: ${results.created}`);
  console.log(`🔄 Updated: ${results.updated}`);
  console.log(`⏭️  Skipped: ${results.skipped}`);
  
  if (results.errors.length > 0) {
    console.log(`\n❌ Errors:`);
    results.errors.forEach(err => console.log(`  - ${err}`));
  }

  console.log('\n✅ All masale products processed!');
  console.log('\n📝 Note: Barcodes have been cleaned (spaces removed)');
  console.log('   The system will automatically handle barcodes with or without spaces.');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

