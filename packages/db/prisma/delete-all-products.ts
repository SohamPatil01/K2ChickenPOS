import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Deleting all products from inventory...');

  try {
    // First, get count of products
    const productCount = await prisma.product.count();
    console.log(`Found ${productCount} product(s) to delete.`);

    if (productCount === 0) {
      console.log('✅ No products to delete.');
      return;
    }

    // Delete all products (cascade will handle related records)
    const result = await prisma.product.deleteMany({});
    
    console.log(`✅ Successfully deleted ${result.count} product(s) from the database.`);
    console.log('\nNote: Related records (prices, inventory ledgers, etc.) may have been deleted due to cascade rules.');
  } catch (error: any) {
    console.error('❌ Error deleting products:', error.message);
    throw error;
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

