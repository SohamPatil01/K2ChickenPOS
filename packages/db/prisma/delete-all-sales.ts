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
  console.log('🗑️  Deleting all sales and related data...\n');

  try {
    // Get counts before deletion
    const saleCount = await prisma.sale.count();
    const paymentCount = await prisma.payment.count();
    const saleItemCount = await prisma.saleItem.count();
    const deliveryOrderCount = await prisma.deliveryOrder.count();
    const discountOverrideCount = await prisma.discountOverride.count();
    const loyaltyTransactionCount = await prisma.loyaltyTransaction.count();
    
    // Count inventory ledger entries related to sales
    const inventoryLedgerCount = await prisma.inventoryLedger.count({
      where: {
        reason: 'SALE',
      },
    });

    console.log('📊 Current data counts:');
    console.log(`   - Sales: ${saleCount}`);
    console.log(`   - Payments: ${paymentCount}`);
    console.log(`   - Sale Items: ${saleItemCount}`);
    console.log(`   - Delivery Orders: ${deliveryOrderCount}`);
    console.log(`   - Discount Overrides: ${discountOverrideCount}`);
    console.log(`   - Loyalty Transactions: ${loyaltyTransactionCount}`);
    console.log(`   - Inventory Ledger (SALE): ${inventoryLedgerCount}\n`);

    if (saleCount === 0) {
      console.log('✅ No sales to delete. System is already fresh!');
      return;
    }

    console.log('⚠️  WARNING: This will permanently delete all sales data!');
    console.log('   This includes:');
    console.log('   - All sales records');
    console.log('   - All payments');
    console.log('   - All sale items');
    console.log('   - All delivery orders');
    console.log('   - All discount overrides');
    console.log('   - All loyalty transactions');
    console.log('   - All inventory ledger entries for sales\n');

    // Delete in order to respect foreign key constraints
    console.log('🔄 Starting deletion process...\n');

    // 1. Delete inventory ledger entries for sales (these reference sales via refId)
    console.log('1. Deleting inventory ledger entries for sales...');
    const inventoryResult = await prisma.inventoryLedger.deleteMany({
      where: {
        reason: 'SALE',
      },
    });
    console.log(`   ✅ Deleted ${inventoryResult.count} inventory ledger entries\n`);

    // 2. Delete loyalty transactions (these reference sales)
    console.log('2. Deleting loyalty transactions...');
    const loyaltyResult = await prisma.loyaltyTransaction.deleteMany({});
    console.log(`   ✅ Deleted ${loyaltyTransactionCount} loyalty transactions\n`);

    // 3. Delete discount overrides (these reference sales)
    console.log('3. Deleting discount overrides...');
    const discountResult = await prisma.discountOverride.deleteMany({});
    console.log(`   ✅ Deleted ${discountOverrideCount} discount overrides\n`);

    // 4. Delete delivery orders (these reference sales)
    console.log('4. Deleting delivery orders...');
    const deliveryResult = await prisma.deliveryOrder.deleteMany({});
    console.log(`   ✅ Deleted ${deliveryOrderCount} delivery orders\n`);

    // 5. Delete payments (cascade from sales, but delete explicitly for clarity)
    console.log('5. Deleting payments...');
    const paymentResult = await prisma.payment.deleteMany({});
    console.log(`   ✅ Deleted ${paymentResult.count} payments\n`);

    // 6. Delete sale items (cascade from sales, but delete explicitly for clarity)
    console.log('6. Deleting sale items...');
    const saleItemResult = await prisma.saleItem.deleteMany({});
    console.log(`   ✅ Deleted ${saleItemResult.count} sale items\n`);

    // 7. Delete sales (this will cascade delete remaining related records)
    console.log('7. Deleting sales...');
    const saleResult = await prisma.sale.deleteMany({});
    console.log(`   ✅ Deleted ${saleResult.count} sales\n`);

    // 8. Reset customer loyalty points and total spent (optional - uncomment if needed)
    // console.log('8. Resetting customer loyalty data...');
    // await prisma.customer.updateMany({
    //   data: {
    //     loyaltyPoints: 0,
    //     totalSpent: 0,
    //   },
    // });
    // console.log('   ✅ Reset customer loyalty points and total spent\n');

    console.log('✅ Successfully deleted all sales and related data!');
    console.log('\n📊 Summary:');
    console.log(`   - Sales deleted: ${saleResult.count}`);
    console.log(`   - Payments deleted: ${paymentResult.count}`);
    console.log(`   - Sale items deleted: ${saleItemResult.count}`);
    console.log(`   - Delivery orders deleted: ${deliveryResult.count}`);
    console.log(`   - Discount overrides deleted: ${discountResult.count}`);
    console.log(`   - Loyalty transactions deleted: ${loyaltyResult.count}`);
    console.log(`   - Inventory ledger entries deleted: ${inventoryResult.count}`);
    console.log('\n✨ System is now fresh and ready for new sales!');
  } catch (error: any) {
    console.error('❌ Error deleting sales:', error.message);
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

