import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from root .env file
config({ path: resolve(__dirname, '../../../.env') });
config({ path: resolve(__dirname, '../../../apps/api/.env') });

const prisma = new PrismaClient();

async function fixInventoryReasonEnum() {
  try {
    console.log('Checking InventoryReason enum values...');
    
    // Get the current enum values from the database
    const enumValues = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid 
        FROM pg_type 
        WHERE typname = 'InventoryReason'
      )
      ORDER BY enumsortorder;
    `;
    
    console.log('Current enum values:', enumValues.map(v => v.enumlabel));
    
    const requiredValues = [
      'SALE',
      'RECEIVE',
      'WASTAGE',
      'ADJUSTMENT',
      'TRANSFER',
      'CORRECTION',
      'DAMAGE',
      'OTHER',
      'OPENING',
      'RETURN',
      'YIELD',
    ];
    
    const existingValues = enumValues.map(v => v.enumlabel);
    const missingValues = requiredValues.filter(v => !existingValues.includes(v));
    
    if (missingValues.length === 0) {
      console.log('✅ All enum values are present. No changes needed.');
      return;
    }
    
    console.log('Missing enum values:', missingValues);
    console.log('Adding missing enum values...');
    
    // Add missing enum values
    for (const value of missingValues) {
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TYPE "InventoryReason" ADD VALUE IF NOT EXISTS '${value}';`
        );
        console.log(`✅ Added ${value} to InventoryReason enum`);
      } catch (error: any) {
        // IF NOT EXISTS might not be supported in all PostgreSQL versions
        // Try without it if the first attempt fails
        if (error.message?.includes('already exists')) {
          console.log(`⚠️  ${value} already exists, skipping...`);
        } else {
          try {
            await prisma.$executeRawUnsafe(
              `ALTER TYPE "InventoryReason" ADD VALUE '${value}';`
            );
            console.log(`✅ Added ${value} to InventoryReason enum`);
          } catch (err: any) {
            console.error(`❌ Failed to add ${value}:`, err.message);
          }
        }
      }
    }
    
    console.log('✅ InventoryReason enum update complete!');
  } catch (error: any) {
    console.error('❌ Error fixing enum:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixInventoryReasonEnum()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

