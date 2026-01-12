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
  const price = 30; // Price per piece

  console.log('Fixing masale product prices for all stores...\n');

  // Find the product
  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { sku: barcode },
        { plu: barcode }
      ],
    },
  });

  if (!product) {
    console.log('❌ Product not found with barcode:', barcode);
    return;
  }

  console.log(`✅ Found product: ${product.name}\n`);

  // Get all stores
  const allStores = await prisma.store.findMany({
    select: { id: true, name: true, type: true },
  });

  console.log(`Found ${allStores.length} store(s)\n`);

  for (const store of allStores) {
    // Check if price already exists
    const existingPrice = await prisma.storeProductPrice.findFirst({
      where: {
        storeId: store.id,
        productId: product.id,
        isActive: true,
      },
    });

    if (existingPrice) {
      if (existingPrice.pricePerUnit === price) {
        console.log(`✓ ${store.name} (${store.type}): Already has correct price (₹${price})`);
      } else {
        // Deactivate old price
        await prisma.storeProductPrice.updateMany({
          where: {
            storeId: store.id,
            productId: product.id,
            isActive: true,
          },
          data: { isActive: false },
        });

        // Create new price
        await prisma.storeProductPrice.create({
          data: {
            storeId: store.id,
            productId: product.id,
            pricePerUnit: price,
            isActive: true,
          },
        });

        console.log(`✓ ${store.name} (${store.type}): Updated price from ₹${existingPrice.pricePerUnit} to ₹${price}`);
      }
    } else {
      // Create new price
      await prisma.storeProductPrice.create({
        data: {
          storeId: store.id,
          productId: product.id,
          pricePerUnit: price,
          isActive: true,
        },
      });

      console.log(`✓ ${store.name} (${store.type}): Added price ₹${price}`);
    }
  }

  console.log('\n✅ All stores now have prices set!');
  console.log('\nThe barcode should now work for all stores.');
  console.log('Try scanning the barcode again.');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

