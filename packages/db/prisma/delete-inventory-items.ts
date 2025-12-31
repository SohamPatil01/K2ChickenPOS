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
  console.log('Deleting inventory items...');

  // Products to delete based on the image
  const productsToDelete = [
    { name: 'Whole Chicken', sku: '10001', plu: 'CHK001' },
    { name: 'Chicken Breast', sku: '10002', plu: 'CHK002' },
    { name: 'Chicken Legs', sku: '10003', plu: 'CHK003' },
    { name: 'Chicken Wings', sku: '10004', plu: 'CHK004' },
    { name: 'Eggs', sku: '20001', plu: 'EGG001' },
    { name: 'Packaging', sku: '30001', plu: 'PKG001' },
  ];

  console.log(`Attempting to delete ${productsToDelete.length} products...\n`);

  let deletedCount = 0;
  let notFoundCount = 0;

  for (const product of productsToDelete) {
    try {
      // Try to find by SKU first, then by PLU
      const foundProduct = await prisma.product.findFirst({
        where: {
          OR: [
            { sku: product.sku },
            { plu: product.plu },
          ],
        },
        select: {
          id: true,
          name: true,
          sku: true,
          plu: true,
        },
      });

      if (foundProduct) {
        // Delete the product (cascade will handle related records)
        await prisma.product.delete({
          where: { id: foundProduct.id },
        });
        console.log(`✅ Deleted: ${foundProduct.name} (SKU: ${foundProduct.sku}, PLU: ${foundProduct.plu})`);
        deletedCount++;
      } else {
        console.log(`⚠️  Not found: ${product.name} (SKU: ${product.sku}, PLU: ${product.plu})`);
        notFoundCount++;
      }
    } catch (error: any) {
      console.error(`❌ Error deleting ${product.name}:`, error.message);
    }
  }

  console.log(`\n✅ Deletion complete!`);
  console.log(`   - Deleted: ${deletedCount} product(s)`);
  console.log(`   - Not found: ${notFoundCount} product(s)`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

