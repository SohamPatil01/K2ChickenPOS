import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@azela-pos/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  const testBarcode = '8906148690207';
  console.log('Testing barcode lookup for:', testBarcode);
  console.log('');

  // Get all stores
  const stores = await prisma.store.findMany({
    select: { id: true, name: true, type: true, parentOwnerStoreId: true },
  });

  for (const store of stores) {
    console.log(`\n=== Testing for store: ${store.name} (${store.type}) ===`);
    
    const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
    console.log(`Owner Store ID: ${ownerStoreId}`);
    
    // Clean barcode
    const cleanBarcode = testBarcode.trim().replace(/\s/g, '');
    console.log(`Cleaned barcode: "${cleanBarcode}"`);
    
    // Test SKU lookup with ownerStoreId
    console.log('\n1. Testing SKU lookup with ownerStoreId:');
    const productBySku = await prisma.product.findFirst({
      where: {
        ownerStoreId,
        sku: cleanBarcode,
        isActive: true,
      },
      include: {
        storeProductPrices: {
          where: {
            storeId: store.id,
            isActive: true,
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
    });
    
    if (productBySku) {
      console.log('  ✅ Found by SKU!');
      console.log(`    Name: ${productBySku.name}`);
      console.log(`    SKU: ${productBySku.sku}`);
      console.log(`    PLU: ${productBySku.plu}`);
      console.log(`    Has Price: ${productBySku.storeProductPrices.length > 0}`);
      if (productBySku.storeProductPrices.length > 0) {
        console.log(`    Price: ₹${productBySku.storeProductPrices[0].pricePerUnit}`);
      }
    } else {
      console.log('  ❌ Not found by SKU');
      
      // Test without ownerStoreId filter
      console.log('\n2. Testing SKU lookup WITHOUT ownerStoreId filter:');
      const productWithoutOwner = await prisma.product.findFirst({
        where: {
          sku: cleanBarcode,
          isActive: true,
        },
      });
      
      if (productWithoutOwner) {
        console.log('  ⚠️  Found product but wrong ownerStoreId!');
        console.log(`    Name: ${productWithoutOwner.name}`);
        console.log(`    SKU: ${productWithoutOwner.sku}`);
        console.log(`    Product ownerStoreId: ${productWithoutOwner.ownerStoreId}`);
        console.log(`    Expected ownerStoreId: ${ownerStoreId}`);
        console.log(`    Match: ${productWithoutOwner.ownerStoreId === ownerStoreId ? '✅' : '❌'}`);
      } else {
        console.log('  ❌ Product not found at all');
      }
      
      // Test PLU lookup
      console.log('\n3. Testing PLU lookup:');
      const productByPlu = await prisma.product.findFirst({
        where: {
          ownerStoreId,
          plu: cleanBarcode,
          isActive: true,
        },
      });
      
      if (productByPlu) {
        console.log('  ✅ Found by PLU!');
        console.log(`    Name: ${productByPlu.name}`);
        console.log(`    SKU: ${productByPlu.sku}`);
        console.log(`    PLU: ${productByPlu.plu}`);
      } else {
        console.log('  ❌ Not found by PLU');
      }
    }
    
    // List all masale products for this owner
    console.log('\n4. All masale products for this owner:');
    const allMasale = await prisma.product.findMany({
      where: {
        ownerStoreId,
        category: {
          name: { equals: 'Spices', mode: 'insensitive' }
        },
        isActive: true,
      },
      select: {
        name: true,
        sku: true,
        plu: true,
      },
      take: 10,
    });
    
    if (allMasale.length > 0) {
      allMasale.forEach(p => {
        const match = p.sku === cleanBarcode || p.plu === cleanBarcode;
        console.log(`  ${match ? '✅' : '  '} ${p.name}: SKU="${p.sku}", PLU="${p.plu}"`);
      });
    } else {
      console.log('  No masale products found for this owner');
    }
  }
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


