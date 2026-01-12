import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { parseScaleBarcode } from '../apps/api/src/utils/barcode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  const barcode = '8906148690207';
  console.log('Testing masale barcode lookup:', barcode);
  console.log('');

  // Get all stores
  const stores = await prisma.store.findMany({
    select: { id: true, name: true, type: true },
  });

  for (const store of stores) {
    console.log(`\n=== Testing for store: ${store.name} (${store.type}) ===`);
    
    // Test the actual parseScaleBarcode function
    try {
      const result = await parseScaleBarcode(barcode, store.id);
      
      if (result) {
        console.log('✅ Barcode parsed successfully!');
        console.log('  Product ID:', result.productId);
        console.log('  PLU:', result.plu);
        console.log('  Qty PCS:', result.qtyPcs);
        console.log('  Price:', result.pricePerKg);
        console.log('  Line Total:', result.lineTotal);
        
        // Verify product exists
        const product = await prisma.product.findUnique({
          where: { id: result.productId },
          include: {
            storeProductPrices: {
              where: {
                storeId: store.id,
                isActive: true,
              },
            },
          },
        });
        
        if (product) {
          console.log('  Product Name:', product.name);
          console.log('  Product SKU:', product.sku);
          console.log('  Product Active:', product.isActive);
          console.log('  Has Price:', product.storeProductPrices.length > 0);
        }
      } else {
        console.log('❌ Barcode parsing returned null');
        
        // Check if product exists
        const product = await prisma.product.findFirst({
          where: {
            OR: [
              { sku: barcode },
              { plu: barcode }
            ],
            isActive: true,
          },
          include: {
            storeProductPrices: {
              where: {
                storeId: store.id,
                isActive: true,
              },
            },
          },
        });
        
        if (product) {
          console.log('⚠️  Product exists but parsing failed:');
          console.log('  Name:', product.name);
          console.log('  SKU:', product.sku);
          console.log('  PLU:', product.plu);
          console.log('  Active:', product.isActive);
          console.log('  Has Price:', product.storeProductPrices.length > 0);
          console.log('  Price:', product.storeProductPrices[0]?.pricePerUnit || 'Not set');
          
          if (product.storeProductPrices.length === 0) {
            console.log('  ❌ ISSUE: No price set for this store!');
          }
        } else {
          console.log('❌ Product not found with barcode:', barcode);
        }
        
        // Check scale barcode config
        const config = await prisma.scaleBarcodeConfig.findFirst({
          where: {
            storeId: store.id,
            isActive: true,
          },
        });
        
        if (config) {
          console.log('⚠️  Scale barcode config exists:');
          console.log('  Name:', config.name);
          console.log('  Prefix:', config.prefix);
          console.log('  Barcode starts with prefix?', barcode.startsWith(config.prefix));
          console.log('  This might be causing the issue - masale barcode doesn\'t match scale format');
        } else {
          console.log('ℹ️  No scale barcode config (this is fine for masale)');
        }
      }
    } catch (error: any) {
      console.error('❌ Error during parsing:', error.message);
      console.error('  Stack:', error.stack);
    }
  }
  
  console.log('\n=== Summary ===');
  console.log('If barcode parsing fails, check:');
  console.log('1. Product exists with SKU matching barcode');
  console.log('2. Product is active');
  console.log('3. Price is set for the store');
  console.log('4. Store ID is correct');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

