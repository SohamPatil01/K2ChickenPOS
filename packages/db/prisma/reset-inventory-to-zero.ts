import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../.env') });

// Use DATABASE_URL from environment (can be overridden for cloud database)
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL environment variable is not set!');
  console.error('   Please set DATABASE_URL before running this script.');
  console.error('   Example: export DATABASE_URL="your-database-connection-string"');
  process.exit(1);
}

console.log('🔗 Database Connection:');
console.log(`   Using: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}\n`);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

async function main() {
  try {
    console.log('Starting inventory reset to zero...');

    // Get all stores
    const stores = await prisma.store.findMany();
    console.log(`Found ${stores.length} stores`);

    let totalProductsReset = 0;
    let totalAdjustmentsCreated = 0;

    for (const store of stores) {
      console.log(`\nProcessing store: ${store.name} (${store.id})`);

      // Get owner store ID
      const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
      if (!ownerStoreId) {
        console.log(`  Skipping store ${store.name} - no owner store ID`);
        continue;
      }

      // Get all active products for this owner store
      const products = await prisma.product.findMany({
        where: {
          ownerStoreId,
          isActive: true,
        },
        include: {
          inventoryLedgers: {
            where: { storeId: store.id },
          },
        },
      });

      console.log(`  Found ${products.length} products`);

      for (const product of products) {
        // Calculate current inventory
        let currentQtyKg = 0;
        let currentQtyPcs = 0;

        for (const ledger of product.inventoryLedgers) {
          if (ledger.type === 'IN') {
            currentQtyKg += ledger.qtyKg || 0;
            currentQtyPcs += ledger.qtyPcs || 0;
          } else {
            currentQtyKg -= ledger.qtyKg || 0;
            currentQtyPcs -= ledger.qtyPcs || 0;
          }
        }

        // Only create adjustment if there's inventory to zero out
        if (currentQtyKg > 0 || currentQtyPcs > 0) {
          // Create OUT adjustment to bring inventory to zero
          await prisma.inventoryLedger.create({
            data: {
              storeId: store.id,
              productId: product.id,
              type: 'OUT',
              qtyKg: currentQtyKg > 0 ? currentQtyKg : undefined,
              qtyPcs: currentQtyPcs > 0 ? currentQtyPcs : undefined,
              reason: 'ADJUSTMENT',
            },
          });

          totalAdjustmentsCreated++;
          totalProductsReset++;

          console.log(
            `  - ${product.name}: Reset ${currentQtyKg > 0 ? `${currentQtyKg} kg` : ''} ${currentQtyPcs > 0 ? `${currentQtyPcs} pcs` : ''}`
          );
        }
      }
    }

    console.log(`\n✅ Inventory reset complete!`);
    console.log(`   - Products reset: ${totalProductsReset}`);
    console.log(`   - Adjustment entries created: ${totalAdjustmentsCreated}`);
  } catch (error: any) {
    console.error('❌ Error resetting inventory:', error.message);
    console.error('Stack:', error.stack);
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

