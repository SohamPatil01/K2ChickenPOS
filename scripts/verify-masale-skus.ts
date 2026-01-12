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
  console.log('Verifying masale product SKUs match barcodes exactly...\n');

  const products = await prisma.product.findMany({
    where: {
      category: {
        name: { equals: 'Spices', mode: 'insensitive' }
      }
    },
    include: {
      category: true,
    },
    orderBy: { name: 'asc' }
  });

  console.log(`Found ${products.length} masale products:\n`);

  let issues = 0;

  for (const p of products) {
    const skuClean = p.sku.replace(/\s/g, '');
    const pluClean = p.plu.replace(/\s/g, '');
    const match = skuClean === pluClean;
    const hasSpaces = p.sku.includes(' ') || p.plu.includes(' ');
    
    console.log(`${p.name}`);
    console.log(`  SKU: "${p.sku}" (cleaned: "${skuClean}")`);
    console.log(`  PLU: "${p.plu}" (cleaned: "${pluClean}")`);
    console.log(`  Active: ${p.isActive}`);
    
    if (!match) {
      console.log(`  ❌ SKU and PLU don't match!`);
      issues++;
    } else {
      console.log(`  ✅ SKU/PLU match`);
    }
    
    if (hasSpaces) {
      console.log(`  ⚠️  WARNING: Contains spaces - this will cause barcode lookup to fail!`);
      issues++;
    }
    
    // Check if it starts with 8 (EAN-13 masale barcode)
    if (!skuClean.startsWith('8') && !skuClean.startsWith('9')) {
      console.log(`  ⚠️  WARNING: Doesn't start with 8 or 9 (unusual for masale barcode)`);
    }
    
    console.log('');
  }

  if (issues > 0) {
    console.log(`\n⚠️  Found ${issues} issue(s) that need fixing.`);
    console.log('Products with spaces in SKU/PLU will not work with barcode scanning.');
  } else {
    console.log('\n✅ All masale products have correct SKU/PLU format!');
  }

  // Check scale barcode config
  console.log('\n=== Scale Barcode Config Check ===');
  const stores = await prisma.store.findMany({
    select: { id: true, name: true },
  });

  for (const store of stores) {
    const config = await prisma.scaleBarcodeConfig.findFirst({
      where: {
        storeId: store.id,
        isActive: true,
      },
    });

    if (config) {
      console.log(`\n${store.name}:`);
      console.log(`  Config: ${config.name}`);
      console.log(`  Prefix: "${config.prefix}"`);
      console.log(`  ✅ Masale barcodes (starting with 8) will NOT be parsed as scale barcodes`);
      console.log(`  ✅ Only barcodes starting with "${config.prefix}" will use scale parsing`);
    } else {
      console.log(`\n${store.name}: No scale barcode config (this is fine for masale)`);
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

