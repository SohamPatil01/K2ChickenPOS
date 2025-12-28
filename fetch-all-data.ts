import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '.env') });

const prisma = new PrismaClient();

async function fetchAllData() {
  console.log('📊 Fetching ALL Database Contents...\n');
  console.log('='.repeat(80));
  console.log();

  try {
    // ==================== STORES ====================
    const stores = await prisma.store.findMany({
      include: {
        _count: {
          select: {
            users: true,
            products: true,
            customers: true,
            sales: true,
            categories: true,
            scaleBarcodeConfigs: true,
            purchaseOrders: true,
            ownerPurchaseOrders: true,
            deliveryOrders: true,
          },
        },
        parentOwnerStore: {
          select: { name: true, type: true },
        },
        franchises: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log('🏪 STORES');
    console.log('─'.repeat(80));
    stores.forEach((store, idx) => {
      console.log(`\n${idx + 1}. ${store.name} (${store.type})`);
      console.log(`   ID: ${store.id}`);
      if (store.parentOwnerStore) {
        console.log(`   Parent Store: ${store.parentOwnerStore.name}`);
      }
      if (store.franchises.length > 0) {
        console.log(`   Franchises: ${store.franchises.map(f => f.name).join(', ')}`);
      }
      console.log(`   Created: ${store.createdAt.toLocaleString()}`);
      console.log(`   Counts: Users=${store._count.users}, Products=${store._count.products}, ` +
                  `Categories=${store._count.categories}, Customers=${store._count.customers}, ` +
                  `Sales=${store._count.sales}, Barcode Configs=${store._count.scaleBarcodeConfigs}`);
    });

    // ==================== USERS ====================
    const users = await prisma.user.findMany({
      include: {
        store: {
          select: { name: true, type: true },
        },
        _count: {
          select: {
            createdSales: true,
            openedShifts: true,
            closedShifts: true,
            assignedDeliveries: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log('\n\n👥 USERS');
    console.log('─'.repeat(80));
    users.forEach((user, idx) => {
      console.log(`\n${idx + 1}. ${user.name} (${user.role})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Store: ${user.store.name} (${user.store.type})`);
      console.log(`   Active: ${user.isActive ? '✅' : '❌'}`);
      console.log(`   Created: ${user.createdAt.toLocaleString()}`);
      console.log(`   Activity: Sales=${user._count.createdSales}, ` +
                  `Shifts Opened=${user._count.openedShifts}, ` +
                  `Shifts Closed=${user._count.closedShifts}, ` +
                  `Deliveries=${user._count.assignedDeliveries}`);
    });

    // ==================== CATEGORIES ====================
    const categories = await prisma.category.findMany({
      include: {
        ownerStore: {
          select: { name: true },
        },
        _count: {
          select: { products: true },
        },
      },
      orderBy: [{ ownerStoreId: 'asc' }, { sortOrder: 'asc' }],
    });

    console.log('\n\n📁 CATEGORIES');
    console.log('─'.repeat(80));
    categories.forEach((category, idx) => {
      console.log(`\n${idx + 1}. ${category.name}`);
      console.log(`   ID: ${category.id}`);
      console.log(`   Store: ${category.ownerStore.name}`);
      console.log(`   Sort Order: ${category.sortOrder}`);
      console.log(`   Products: ${category._count.products}`);
      console.log(`   Created: ${category.createdAt.toLocaleString()}`);
    });

    // ==================== PRODUCTS ====================
    const products = await prisma.product.findMany({
      include: {
        category: {
          select: { name: true },
        },
        ownerStore: {
          select: { name: true },
        },
        storeProductPrices: {
          include: {
            store: {
              select: { name: true },
            },
          },
          where: { isActive: true },
          orderBy: { effectiveFrom: 'desc' },
        },
        _count: {
          select: {
            saleItems: true,
            inventoryLedgers: true,
          },
        },
      },
      orderBy: [{ ownerStoreId: 'asc' }, { name: 'asc' }],
    });

    console.log('\n\n🛒 PRODUCTS');
    console.log('─'.repeat(80));
    products.forEach((product, idx) => {
      console.log(`\n${idx + 1}. ${product.name}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   SKU: ${product.sku}, PLU: ${product.plu}`);
      console.log(`   Store: ${product.ownerStore.name}`);
      console.log(`   Category: ${product.category.name}`);
      console.log(`   Unit: ${product.unitType}, Tax: ${product.taxRate}%`);
      console.log(`   Active: ${product.isActive ? '✅' : '❌'}`);
      console.log(`   Prices:`);
      product.storeProductPrices.forEach((price) => {
        console.log(`     - ${price.store.name}: ₹${price.pricePerUnit}/${product.unitType} (from ${price.effectiveFrom.toLocaleDateString()})`);
      });
      console.log(`   Sales: ${product._count.saleItems} items, Inventory Movements: ${product._count.inventoryLedgers}`);
      console.log(`   Created: ${product.createdAt.toLocaleString()}`);
    });

    // ==================== CUSTOMERS ====================
    const customers = await prisma.customer.findMany({
      include: {
        store: {
          select: { name: true },
        },
        addresses: true,
        _count: {
          select: {
            sales: true,
            addresses: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n\n👤 CUSTOMERS');
    console.log('─'.repeat(80));
    customers.forEach((customer, idx) => {
      console.log(`\n${idx + 1}. ${customer.name}`);
      console.log(`   ID: ${customer.id}`);
      console.log(`   Phone: ${customer.phone}`);
      console.log(`   Email: ${customer.email || 'N/A'}`);
      console.log(`   Store: ${customer.store.name}`);
      console.log(`   Sales: ${customer._count.sales}, Addresses: ${customer._count.addresses}`);
      if (customer.addresses.length > 0) {
        console.log(`   Addresses:`);
        customer.addresses.forEach((addr) => {
          console.log(`     - ${addr.label}: ${addr.line1}, ${addr.city}, ${addr.state} ${addr.zip}`);
        });
      }
      console.log(`   Created: ${customer.createdAt.toLocaleString()}`);
    });

    // ==================== SALES ====================
    const sales = await prisma.sale.findMany({
      include: {
        store: {
          select: { name: true },
        },
        customer: {
          select: { name: true, phone: true },
        },
        createdBy: {
          select: { name: true, role: true },
        },
        items: {
          include: {
            product: {
              select: { name: true, sku: true, unitType: true },
            },
          },
        },
        payments: true,
        _count: {
          select: {
            items: true,
            payments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n\n💰 SALES');
    console.log('─'.repeat(80));
    if (sales.length === 0) {
      console.log('   No sales found.');
    } else {
      sales.forEach((sale, idx) => {
        console.log(`\n${idx + 1}. Sale #${sale.saleNo}`);
        console.log(`   ID: ${sale.id}`);
        console.log(`   Store: ${sale.store.name}`);
        console.log(`   Customer: ${sale.customer?.name || 'Walk-in'} (${sale.customer?.phone || 'N/A'})`);
        console.log(`   Status: ${sale.status}`);
        console.log(`   Subtotal: ₹${sale.subTotal.toFixed(2)}`);
        console.log(`   Discount: ₹${sale.discountTotal.toFixed(2)}`);
        console.log(`   Tax: ₹${sale.taxTotal.toFixed(2)}`);
        console.log(`   Grand Total: ₹${sale.grandTotal.toFixed(2)}`);
        console.log(`   Created by: ${sale.createdBy.name} (${sale.createdBy.role})`);
        console.log(`   Items (${sale.items.length}):`);
        sale.items.forEach((item) => {
          const qty = item.qtyKg ? `${item.qtyKg} ${item.product.unitType}` : `${item.qtyPcs} ${item.product.unitType}`;
          console.log(`     - ${item.product.name} (${item.product.sku}): ${qty} @ ₹${item.rate}/${item.product.unitType} = ₹${item.lineTotal.toFixed(2)}`);
        });
        console.log(`   Payments (${sale.payments.length}):`);
        sale.payments.forEach((payment) => {
          console.log(`     - ${payment.method}: ₹${payment.amount.toFixed(2)}${payment.txnRef ? ` (Ref: ${payment.txnRef})` : ''}`);
        });
        console.log(`   Created: ${sale.createdAt.toLocaleString()}`);
      });
    }

    // ==================== SCALE BARCODE CONFIGS ====================
    const scaleConfigs = await prisma.scaleBarcodeConfig.findMany({
      include: {
        store: {
          select: { name: true, type: true },
        },
      },
      orderBy: [{ storeId: 'asc' }, { isActive: 'desc' }, { createdAt: 'asc' }],
    });

    console.log('\n\n⚖️ SCALE BARCODE CONFIGURATIONS');
    console.log('─'.repeat(80));
    scaleConfigs.forEach((config, idx) => {
      console.log(`\n${idx + 1}. ${config.name} ${config.isActive ? '✅ ACTIVE' : '❌ INACTIVE'}`);
      console.log(`   ID: ${config.id}`);
      console.log(`   Store: ${config.store.name} (${config.store.type})`);
      console.log(`   Prefix: "${config.prefix}"`);
      console.log(`   PLU: Start=${config.pluStart}, Length=${config.pluLength}`);
      console.log(`   Weight: Start=${config.weightStart}, Length=${config.weightLength}, Decimals=${config.weightDecimal}`);
      console.log(`   Price: Start=${config.priceStart ?? 'N/A'}, Length=${config.priceLength ?? 'N/A'}, Decimals=${config.priceDecimal ?? 'N/A'}`);
      console.log(`   Checksum: ${config.checksumType}`);
      console.log(`   Created: ${config.createdAt.toLocaleString()}`);
    });

    // ==================== SHIFTS ====================
    const shifts = await prisma.shift.findMany({
      include: {
        store: {
          select: { name: true },
        },
        opener: {
          select: { name: true, role: true },
        },
        closer: {
          select: { name: true, role: true },
        },
      },
      orderBy: { openedAt: 'desc' },
      take: 20,
    });

    console.log('\n\n🕐 SHIFTS (Last 20)');
    console.log('─'.repeat(80));
    if (shifts.length === 0) {
      console.log('   No shifts found.');
    } else {
      shifts.forEach((shift, idx) => {
        console.log(`\n${idx + 1}. Shift ${shift.id.substring(0, 8)}...`);
        console.log(`   Store: ${shift.store.name}`);
        console.log(`   Opened by: ${shift.opener.name} (${shift.opener.role}) at ${shift.openedAt.toLocaleString()}`);
        console.log(`   Cash Start: ₹${shift.cashStart.toFixed(2)}`);
        if (shift.closedAt) {
          console.log(`   Closed by: ${shift.closer?.name || 'N/A'} (${shift.closer?.role || 'N/A'}) at ${shift.closedAt.toLocaleString()}`);
          console.log(`   Cash End: ₹${shift.cashEnd?.toFixed(2) || 'N/A'}`);
        } else {
          console.log(`   Status: 🔓 OPEN`);
        }
      });
    }

    // ==================== INVENTORY LEDGERS ====================
    const inventoryLedgers = await prisma.inventoryLedger.findMany({
      include: {
        store: {
          select: { name: true },
        },
        product: {
          select: { name: true, sku: true, unitType: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    console.log('\n\n📦 INVENTORY LEDGERS (Last 20)');
    console.log('─'.repeat(80));
    if (inventoryLedgers.length === 0) {
      console.log('   No inventory movements found.');
    } else {
      inventoryLedgers.forEach((ledger, idx) => {
        const qty = ledger.qtyKg ? `${ledger.qtyKg} ${ledger.product.unitType}` : `${ledger.qtyPcs} ${ledger.product.unitType}`;
        console.log(`\n${idx + 1}. ${ledger.type} - ${ledger.product.name} (${ledger.product.sku})`);
        console.log(`   Store: ${ledger.store.name}`);
        console.log(`   Quantity: ${qty}`);
        console.log(`   Reason: ${ledger.reason}`);
        console.log(`   Ref ID: ${ledger.refId || 'N/A'}`);
        console.log(`   Created: ${ledger.createdAt.toLocaleString()}`);
      });
    }

    // ==================== PURCHASE ORDERS ====================
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      include: {
        franchiseStore: {
          select: { name: true },
        },
        ownerStore: {
          select: { name: true },
        },
        items: {
          include: {
            product: {
              select: { name: true, sku: true },
            },
          },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n\n📋 PURCHASE ORDERS');
    console.log('─'.repeat(80));
    if (purchaseOrders.length === 0) {
      console.log('   No purchase orders found.');
    } else {
      purchaseOrders.forEach((po, idx) => {
        console.log(`\n${idx + 1}. PO #${po.poNo}`);
        console.log(`   ID: ${po.id}`);
        console.log(`   Franchise: ${po.franchiseStore.name}`);
        console.log(`   Owner: ${po.ownerStore.name}`);
        console.log(`   Status: ${po.status}`);
        console.log(`   Items: ${po._count.items}`);
        if (po.notes) console.log(`   Notes: ${po.notes}`);
        console.log(`   Created: ${po.createdAt.toLocaleString()}`);
      });
    }

    // ==================== DELIVERY ORDERS ====================
    const deliveryOrders = await prisma.deliveryOrder.findMany({
      include: {
        store: {
          select: { name: true },
        },
        sale: {
          select: { saleNo: true, grandTotal: true },
        },
        assignedDriver: {
          select: { name: true, phone: true },
        },
        address: true,
        _count: {
          select: { events: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n\n🚚 DELIVERY ORDERS');
    console.log('─'.repeat(80));
    if (deliveryOrders.length === 0) {
      console.log('   No delivery orders found.');
    } else {
      deliveryOrders.forEach((delivery, idx) => {
        console.log(`\n${idx + 1}. Delivery for Sale #${delivery.sale.saleNo}`);
        console.log(`   ID: ${delivery.id}`);
        console.log(`   Store: ${delivery.store.name}`);
        console.log(`   Type: ${delivery.type}`);
        console.log(`   Status: ${delivery.status}`);
        if (delivery.assignedDriver) {
          console.log(`   Driver: ${delivery.assignedDriver.name} (${delivery.assignedDriver.phone})`);
        }
        if (delivery.address) {
          console.log(`   Address: ${delivery.address.line1}, ${delivery.address.city}`);
        }
        console.log(`   Delivery Fee: ₹${delivery.deliveryFee.toFixed(2)}`);
        console.log(`   Events: ${delivery._count.events}`);
        console.log(`   Created: ${delivery.createdAt.toLocaleString()}`);
      });
    }

    // ==================== SUMMARY ====================
    const summary = {
      stores: await prisma.store.count(),
      users: await prisma.user.count(),
      categories: await prisma.category.count(),
      products: await prisma.product.count(),
      customers: await prisma.customer.count(),
      sales: await prisma.sale.count(),
      scaleConfigs: await prisma.scaleBarcodeConfig.count(),
      shifts: await prisma.shift.count(),
      inventoryLedgers: await prisma.inventoryLedger.count(),
      purchaseOrders: await prisma.purchaseOrder.count(),
      deliveryOrders: await prisma.deliveryOrder.count(),
    };

    const totalSalesAmount = await prisma.sale.aggregate({
      where: { status: 'PAID' },
      _sum: { grandTotal: true },
    });

    console.log('\n\n📈 DATABASE SUMMARY');
    console.log('='.repeat(80));
    console.log(`  Stores: ${summary.stores}`);
    console.log(`  Users: ${summary.users}`);
    console.log(`  Categories: ${summary.categories}`);
    console.log(`  Products: ${summary.products}`);
    console.log(`  Customers: ${summary.customers}`);
    console.log(`  Sales: ${summary.sales}`);
    console.log(`  Scale Barcode Configs: ${summary.scaleConfigs}`);
    console.log(`  Shifts: ${summary.shifts}`);
    console.log(`  Inventory Movements: ${summary.inventoryLedgers}`);
    console.log(`  Purchase Orders: ${summary.purchaseOrders}`);
    console.log(`  Delivery Orders: ${summary.deliveryOrders}`);
    console.log(`  Total Sales Revenue: ₹${totalSalesAmount._sum.grandTotal?.toFixed(2) || '0.00'}`);
    console.log('='.repeat(80));
    console.log('\n✅ All data fetched successfully!\n');

  } catch (error: any) {
    console.error('❌ Error fetching database:', error.message);
    if (error.message?.includes('DATABASE_URL') || error.message?.includes('P1001')) {
      console.error('\n💡 Make sure your DATABASE_URL is set in .env file');
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fetchAllData();

