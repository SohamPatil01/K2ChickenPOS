import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

interface BarcodeConfig {
  name: string;
  prefix: string;
  pluStart: number;
  pluLength: number;
  weightStart: number;
  weightLength: number;
  weightDecimal: number;
  priceStart?: number;
  priceLength?: number;
  priceDecimal?: number;
  checksumType: 'NONE' | 'MOD10' | 'MOD11';
  isActive: boolean;
}

async function main() {
  console.log('Barcode Configuration Setup\n');
  console.log('This script helps you add a scale barcode configuration.\n');

  // Get owner store
  const ownerStore = await prisma.store.findFirst({ 
    where: { type: 'OWNER' },
    select: { id: true, name: true }
  });

  if (!ownerStore) {
    console.error('❌ Owner store not found');
    process.exit(1);
  }

  console.log(`✓ Found owner store: ${ownerStore.name}\n`);

  // Check existing configs
  const existingConfigs = await prisma.scaleBarcodeConfig.findMany({
    where: { storeId: ownerStore.id },
    orderBy: { createdAt: 'desc' },
  });

  if (existingConfigs.length > 0) {
    console.log('Existing configurations:');
    existingConfigs.forEach((config, index) => {
      console.log(`  ${index + 1}. ${config.name} (${config.isActive ? 'Active' : 'Inactive'})`);
      console.log(`     Prefix: ${config.prefix}, PLU: ${config.pluLength} digits`);
    });
    console.log('');
  }

  // Example configuration (Machine Barcode Format)
  const exampleConfig: BarcodeConfig = {
    name: 'Machine Barcode Format',
    prefix: '20',
    pluStart: 0,
    pluLength: 5,
    weightStart: 0,
    weightLength: 0, // Weight not encoded, will be calculated
    weightDecimal: 2,
    priceStart: 5,
    priceLength: 5,
    priceDecimal: 2,
    checksumType: 'NONE',
    isActive: true,
  };

  console.log('Example Configuration (Machine Barcode Format):');
  console.log('  Barcode format: 2000001730003');
  console.log('  Breakdown:');
  console.log('    - Prefix: 20 (fixed)');
  console.log('    - Product ID: 00001 (5 digits, position 0-4)');
  console.log('    - Total Price: 73000 (5 digits = ₹730.00, position 5-9)');
  console.log('    - Checksum: 3 (1 digit)');
  console.log('');

  // Check if example config already exists
  const existingExample = existingConfigs.find(c => c.name === exampleConfig.name);
  
  if (existingExample) {
    console.log(`⚠ Configuration "${exampleConfig.name}" already exists.`);
    console.log('   Use the web UI or API to update it, or choose a different name.\n');
  } else {
    console.log('Creating example configuration...');
    
    try {
      const config = await prisma.scaleBarcodeConfig.create({
        data: {
          storeId: ownerStore.id,
          ...exampleConfig,
        },
      });

      console.log('✅ Configuration created successfully!\n');
      console.log('Configuration Details:');
      console.log(`  ID: ${config.id}`);
      console.log(`  Name: ${config.name}`);
      console.log(`  Prefix: ${config.prefix}`);
      console.log(`  PLU Start: ${config.pluStart}, Length: ${config.pluLength}`);
      console.log(`  Weight Start: ${config.weightStart}, Length: ${config.weightLength}`);
      console.log(`  Price Start: ${config.priceStart}, Length: ${config.priceLength}, Decimals: ${config.priceDecimal}`);
      console.log(`  Checksum: ${config.checksumType}`);
      console.log(`  Active: ${config.isActive ? 'Yes' : 'No'}\n`);
    } catch (error: any) {
      console.error('❌ Error creating configuration:', error.message);
      if (error.code === 'P2002') {
        console.error('   A configuration with this name already exists for this store.');
      }
      process.exit(1);
    }
  }

  console.log('📖 How to add custom configurations:');
  console.log('');
  console.log('Method 1: Through Web UI');
  console.log('  1. Go to Settings → Scale Barcode Configuration');
  console.log('  2. Click "Add Configuration"');
  console.log('  3. Fill in the form with your barcode format details');
  console.log('');
  console.log('Method 2: Through API');
  console.log('  POST /api/v1/scale/config');
  console.log('  Headers: Authorization: Bearer <token>');
  console.log('  Body: {');
  console.log('    "name": "Your Config Name",');
  console.log('    "prefix": "20",');
  console.log('    "pluStart": 0,');
  console.log('    "pluLength": 5,');
  console.log('    "weightStart": 0,');
  console.log('    "weightLength": 0,');
  console.log('    "weightDecimal": 2,');
  console.log('    "priceStart": 5,');
  console.log('    "priceLength": 5,');
  console.log('    "priceDecimal": 2,');
  console.log('    "checksumType": "NONE",');
  console.log('    "isActive": true');
  console.log('  }');
  console.log('');
  console.log('Method 3: Modify this script');
  console.log('  Edit scripts/add-barcode-config.ts and add your custom configuration');
  console.log('');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

