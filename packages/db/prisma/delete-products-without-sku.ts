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
  console.log('Finding products without SKU...');

  // Get all products and filter for those without valid SKU
  const allProducts = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      sku: true,
      plu: true,
    },
  });

  // Filter products where SKU is empty or just whitespace
  const productsWithEmptySku = allProducts.filter(
    (p) => !p.sku || p.sku.trim() === ''
  );

  console.log(`Found ${productsWithEmptySku.length} product(s) without valid SKU:`);
  productsWithEmptySku.forEach((p) => {
    console.log(`  - ${p.name} (ID: ${p.id}, SKU: "${p.sku}", PLU: ${p.plu})`);
  });

  if (productsWithEmptySku.length === 0) {
    console.log('✅ No products without SKU found.');
    return;
  }

  // Delete products without SKU
  console.log('\nDeleting products without SKU...');
  const deleteResult = await prisma.product.deleteMany({
    where: {
      id: {
        in: productsWithEmptySku.map((p) => p.id),
      },
    },
  });

  console.log(`✅ Successfully deleted ${deleteResult.count} product(s) without SKU.`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

