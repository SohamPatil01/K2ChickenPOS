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
  console.log('Adding Mutton Rassa Masala product...\n');

  // Get owner store
  const ownerStore = await prisma.store.findFirst({ 
    where: { type: 'OWNER' },
    select: { id: true, name: true }
  });

  if (!ownerStore) {
    console.error('❌ Owner store not found');
    process.exit(1);
  }

  console.log(`✓ Found owner store: ${ownerStore.name} (${ownerStore.id})\n`);

  // Get or create "Spices" category
  let category = await prisma.category.findFirst({
    where: { 
      ownerStoreId: ownerStore.id, 
      name: { equals: 'Spices', mode: 'insensitive' }
    },
  });

  if (!category) {
    // Try "Masale" as alternative
    category = await prisma.category.findFirst({
      where: { 
        ownerStoreId: ownerStore.id, 
        name: { equals: 'Masale', mode: 'insensitive' }
      },
    });
  }

  if (!category) {
    console.log('Creating "Spices" category...');
    category = await prisma.category.create({
      data: {
        ownerStoreId: ownerStore.id,
        name: 'Spices',
        sortOrder: 100,
      },
    });
    console.log(`✓ Created category: ${category.name}\n`);
  } else {
    console.log(`✓ Using existing category: ${category.name}\n`);
  }

  // Product details
  const barcode = '8906148690207'; // Cleaned barcode (removed spaces)
  const productName = 'Mutton Rassa Masala';
  const price = 30;
  const unitType = 'PCS';
  const plu = barcode; // Use barcode as PLU

  // Check if product already exists
  const existingProduct = await prisma.product.findFirst({
    where: {
      ownerStoreId: ownerStore.id,
      OR: [
        { sku: barcode },
        { plu: plu }
      ]
    },
  });

  if (existingProduct) {
    console.log(`⚠ Product with barcode ${barcode} already exists:`);
    console.log(`  Name: ${existingProduct.name}`);
    console.log(`  SKU: ${existingProduct.sku}`);
    console.log(`  PLU: ${existingProduct.plu}`);
    console.log('\nUpdating price...');

    // Update price
    await prisma.storeProductPrice.updateMany({
      where: {
        storeId: ownerStore.id,
        productId: existingProduct.id,
        isActive: true,
      },
      data: { isActive: false },
    });

    await prisma.storeProductPrice.create({
      data: {
        storeId: ownerStore.id,
        productId: existingProduct.id,
        pricePerUnit: price,
        isActive: true,
      },
    });

    console.log(`✓ Updated price to ₹${price}/piece\n`);
    console.log('✅ Product already exists, price updated!');
    return;
  }

  // Create product
  console.log('Creating product...');
  console.log(`  Name: ${productName}`);
  console.log(`  Barcode (SKU): ${barcode}`);
  console.log(`  PLU: ${plu}`);
  console.log(`  Category: ${category.name}`);
  console.log(`  Unit Type: ${unitType}`);
  console.log(`  Price: ₹${price}/piece\n`);

  const product = await prisma.product.create({
    data: {
      ownerStoreId: ownerStore.id,
      sku: barcode,
      plu: plu,
      name: productName,
      categoryId: category.id,
      unitType: unitType,
      taxRate: 0,
      isActive: true,
    },
    include: { category: true },
  });

  console.log(`✓ Created product: ${product.name} (ID: ${product.id})\n`);

  // Create price for owner store
  console.log('Setting price...');
  const storePrice = await prisma.storeProductPrice.create({
    data: {
      storeId: ownerStore.id,
      productId: product.id,
      pricePerUnit: price,
      isActive: true,
    },
  });

  console.log(`✓ Set price: ₹${storePrice.pricePerUnit}/piece\n`);

  console.log('✅ Product added successfully!');
  console.log('\nProduct Summary:');
  console.log(`  ID: ${product.id}`);
  console.log(`  Name: ${product.name}`);
  console.log(`  SKU: ${product.sku}`);
  console.log(`  PLU: ${product.plu}`);
  console.log(`  Category: ${product.category.name}`);
  console.log(`  Unit: ${product.unitType}`);
  console.log(`  Price: ₹${price}/piece`);
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

