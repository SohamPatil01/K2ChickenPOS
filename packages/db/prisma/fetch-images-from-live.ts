import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

// Get API URL from command line argument, environment, or use default
const args = process.argv.slice(2);
const API_URL_ARG = args.find(arg => arg.startsWith('--api-url='))?.split('=')[1];
const API_URL = API_URL_ARG || process.env.LIVE_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

async function main() {
  console.log('🔄 Fetching product images from live application...\n');
  console.log(`📡 API URL: ${API_URL}\n`);

  try {
    // Step 1: Fetch products from live API
    console.log('1. Fetching products from live API...');
    let liveProducts;
    
    try {
      const response = await axios.get(`${API_URL}/api/v1/products`, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      });
      liveProducts = response.data || [];
      console.log(`   ✅ Fetched ${liveProducts.length} products from live API\n`);
    } catch (error: any) {
      console.error('   ❌ Failed to fetch from live API:', error.message);
      if (error.response) {
        console.error('   Response status:', error.response.status);
        console.error('   Response data:', error.response.data);
      }
      console.error('\n💡 Make sure:');
      console.error('   1. The live API is accessible');
      console.error('   2. Set LIVE_API_URL environment variable: export LIVE_API_URL="https://your-api-url.com"');
      console.error('   3. Or pass API URL as argument: --api-url=https://your-api-url.com');
      console.error('   4. The API endpoint /api/v1/products is working');
      console.error('\n📝 Example usage:');
      console.error('   export LIVE_API_URL="https://your-api.vercel.app"');
      console.error('   npm run fetch-images-from-live');
      console.error('\n   OR');
      console.error('   npm run fetch-images-from-live -- --api-url=https://your-api.vercel.app');
      throw error;
    }

    if (liveProducts.length === 0) {
      console.log('⚠️  No products found in live API');
      return;
    }

    // Step 2: Get all products from database
    console.log('2. Loading products from database...');
    const dbProducts = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        plu: true,
        imageUrl: true,
      },
    });
    console.log(`   ✅ Found ${dbProducts.length} products in database\n`);

    // Step 3: Match and update products
    console.log('3. Matching and updating product images...\n');
    
    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;

    for (const dbProduct of dbProducts) {
      // Try to find matching product in live API by SKU, PLU, or name
      const liveProduct = liveProducts.find((lp: any) => 
        lp.sku === dbProduct.sku || 
        lp.plu === dbProduct.plu || 
        lp.name?.toLowerCase() === dbProduct.name.toLowerCase()
      );

      if (!liveProduct) {
        console.log(`⚠️  No match found for: ${dbProduct.name} (SKU: ${dbProduct.sku})`);
        notFoundCount++;
        continue;
      }

      // Check if live product has an image
      if (!liveProduct.imageUrl) {
        console.log(`⏭️  Skipping "${dbProduct.name}" - no image in live API`);
        skippedCount++;
        continue;
      }

      // Check if image is already the same
      if (dbProduct.imageUrl === liveProduct.imageUrl) {
        console.log(`⏭️  Skipping "${dbProduct.name}" - image already up to date`);
        skippedCount++;
        continue;
      }

      // Update product with image from live API
      try {
        await prisma.product.update({
          where: { id: dbProduct.id },
          data: { imageUrl: liveProduct.imageUrl },
        });
        console.log(`✅ Updated "${dbProduct.name}" with image from live API`);
        console.log(`   Image URL: ${liveProduct.imageUrl.substring(0, 80)}...`);
        updatedCount++;
      } catch (error: any) {
        console.error(`❌ Error updating "${dbProduct.name}":`, error.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   - Updated: ${updatedCount} products`);
    console.log(`   - Skipped: ${skippedCount} products`);
    console.log(`   - Not found in live API: ${notFoundCount} products`);
    console.log('\n✨ Product images synced successfully!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
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

