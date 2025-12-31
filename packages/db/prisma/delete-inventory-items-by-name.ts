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
  console.log('Deleting inventory items by name...');

  // Product names to delete based on the image
  const productNames = [
    'Whole Chicken',
    'Chicken Breast',
    'Chicken Legs',
    'Chicken Wings',
    'Eggs',
    'Packaging',
  ];

  console.log(`Attempting to delete ${productNames.length} products...\n`);

  let deletedCount = 0;
  let notFoundCount = 0;

  for (const productName of productNames) {
    try {
      // Find products by name (case-insensitive, partial match)
      const foundProducts = await prisma.product.findMany({
        where: {
          name: {
            contains: productName,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          plu: true,
        },
      });

      if (foundProducts.length > 0) {
        for (const product of foundProducts) {
          // Delete the product (cascade will handle related records)
          await prisma.product.delete({
            where: { id: product.id },
          });
          console.log(`✅ Deleted: ${product.name} (SKU: ${product.sku}, PLU: ${product.plu})`);
          deletedCount++;
        }
      } else {
        console.log(`⚠️  Not found: ${productName}`);
        notFoundCount++;
      }
    } catch (error: any) {
      console.error(`❌ Error deleting ${productName}:`, error.message);
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

