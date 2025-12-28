import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Load .env file from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data (for development)
  console.log('Clearing existing data...');
  // Use try-catch to handle tables that might not exist
  const clearTable = async (operation: () => Promise<any>, tableName: string) => {
    try {
      await operation();
    } catch (error: any) {
      if (error.code === 'P2021') {
        console.log(`Table ${tableName} does not exist, skipping...`);
      } else {
        throw error;
      }
    }
  };
  
  await clearTable(() => prisma.loyaltyTransaction.deleteMany(), 'LoyaltyTransaction');
  await clearTable(() => prisma.dailyClosing.deleteMany(), 'DailyClosing');
  await clearTable(() => prisma.discountOverride.deleteMany(), 'DiscountOverride');
  await clearTable(() => prisma.deliveryEvent.deleteMany(), 'DeliveryEvent');
  await clearTable(() => prisma.deliveryOrder.deleteMany(), 'DeliveryOrder');
  await clearTable(() => prisma.payment.deleteMany(), 'Payment');
  await clearTable(() => prisma.saleItem.deleteMany(), 'SaleItem');
  await clearTable(() => prisma.sale.deleteMany(), 'Sale');
  await clearTable(() => prisma.customerAddress.deleteMany(), 'CustomerAddress');
  await clearTable(() => prisma.customer.deleteMany(), 'Customer');
  await clearTable(() => prisma.scaleBarcodeConfig.deleteMany(), 'ScaleBarcodeConfig');
  await clearTable(() => prisma.storeProductPrice.deleteMany(), 'StoreProductPrice');
  await clearTable(() => prisma.inventoryLedger.deleteMany(), 'InventoryLedger');
  await clearTable(() => prisma.product.deleteMany(), 'Product');
  await clearTable(() => prisma.category.deleteMany(), 'Category');
  await clearTable(() => prisma.user.deleteMany(), 'User');
  await clearTable(() => prisma.store.deleteMany(), 'Store');

  // Create Owner Store
  const ownerStore = await prisma.store.create({
    data: {
      name: 'Main Owner Store',
      type: 'OWNER',
    },
  });

  // Create Franchise Store
  const franchiseStore = await prisma.store.create({
    data: {
      name: 'Franchise Store 1',
      type: 'FRANCHISE',
      parentOwnerStoreId: ownerStore.id,
    },
  });

  // Create Users
  const ownerPassword = await bcrypt.hash('owner123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);
  const cashierPassword = await bcrypt.hash('cashier123', 10);
  const driverPassword = await bcrypt.hash('driver123', 10);

  const owner = await prisma.user.create({
    data: {
      storeId: ownerStore.id,
      name: 'Owner User',
      phone: '9999999999',
      email: 'owner@azela.com',
      role: 'OWNER',
      passwordHash: ownerPassword,
    },
  });

  const manager = await prisma.user.create({
    data: {
      storeId: franchiseStore.id,
      name: 'Manager User',
      phone: '8888888888',
      email: 'manager@azela.com',
      role: 'MANAGER',
      passwordHash: managerPassword,
    },
  });

  const cashier = await prisma.user.create({
    data: {
      storeId: franchiseStore.id,
      name: 'Cashier User',
      phone: '7777777777',
      email: 'cashier@azela.com',
      role: 'CASHIER',
      passwordHash: cashierPassword,
    },
  });

  const driver = await prisma.user.create({
    data: {
      storeId: franchiseStore.id,
      name: 'Driver User',
      phone: '6666666666',
      email: 'driver@azela.com',
      role: 'DRIVER',
      passwordHash: driverPassword,
    },
  });

  // Create Categories
  const rawChicken = await prisma.category.create({
    data: {
      ownerStoreId: ownerStore.id,
      name: 'Raw Chicken',
      sortOrder: 1,
    },
  });

  const cuts = await prisma.category.create({
    data: {
      ownerStoreId: ownerStore.id,
      name: 'Cuts',
      sortOrder: 2,
    },
  });

  const addons = await prisma.category.create({
    data: {
      ownerStoreId: ownerStore.id,
      name: 'Add-ons',
      sortOrder: 3,
    },
  });

  // Create Products
  const products = [
    {
      ownerStoreId: ownerStore.id,
      sku: '00001',
      plu: '00001',
      name: 'Aniket',
      categoryId: rawChicken.id,
      unitType: 'KG' as const,
      taxRate: 5,
    },
    {
      ownerStoreId: ownerStore.id,
      sku: 'CHK001',
      plu: '10001',
      name: 'Whole Chicken',
      categoryId: rawChicken.id,
      unitType: 'KG' as const,
      taxRate: 5,
    },
    {
      ownerStoreId: ownerStore.id,
      sku: 'CHK002',
      plu: '10002',
      name: 'Chicken Breast',
      categoryId: cuts.id,
      unitType: 'KG' as const,
      taxRate: 5,
    },
    {
      ownerStoreId: ownerStore.id,
      sku: 'CHK003',
      plu: '10003',
      name: 'Chicken Legs',
      categoryId: cuts.id,
      unitType: 'KG' as const,
      taxRate: 5,
    },
    {
      ownerStoreId: ownerStore.id,
      sku: 'CHK004',
      plu: '10004',
      name: 'Chicken Wings',
      categoryId: cuts.id,
      unitType: 'KG' as const,
      taxRate: 5,
    },
    {
      ownerStoreId: ownerStore.id,
      sku: 'EGG001',
      plu: '20001',
      name: 'Eggs',
      categoryId: addons.id,
      unitType: 'PCS' as const,
      taxRate: 0,
    },
    {
      ownerStoreId: ownerStore.id,
      sku: 'PKG001',
      plu: '30001',
      name: 'Packaging',
      categoryId: addons.id,
      unitType: 'PCS' as const,
      taxRate: 0,
    },
  ];

  for (const productData of products) {
    const product = await prisma.product.create({
      data: productData,
    });

    // Set prices for owner store
    let pricePerUnit = 200; // default for chicken products
    if (productData.sku === '00001') {
      pricePerUnit = 500; // Aniket product price (matches barcode example: 500.00/kg)
    } else if (productData.sku.startsWith('EGG')) {
      pricePerUnit = 10;
    } else if (productData.sku.startsWith('PKG')) {
      pricePerUnit = 5;
    }
    
    await prisma.storeProductPrice.create({
      data: {
        storeId: ownerStore.id,
        productId: product.id,
        pricePerUnit,
        isActive: true,
      },
    });

    // Set prices for franchise store
    let franchisePrice = 220; // default for chicken products
    if (productData.sku === '00001') {
      franchisePrice = 500; // Aniket product price
    } else if (productData.sku.startsWith('EGG')) {
      franchisePrice = 12;
    } else if (productData.sku.startsWith('PKG')) {
      franchisePrice = 6;
    }
    
    await prisma.storeProductPrice.create({
      data: {
        storeId: franchiseStore.id,
        productId: product.id,
        pricePerUnit: franchisePrice,
        isActive: true,
      },
    });
  }

  // Create Scale Barcode Configs
  // Machine Barcode Format (from BARCODE_CONFIG_GUIDE.md)
  await prisma.scaleBarcodeConfig.create({
    data: {
      storeId: ownerStore.id,
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
    },
  });

  // Also create for franchise store
  await prisma.scaleBarcodeConfig.create({
    data: {
      storeId: franchiseStore.id,
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
    },
  });

  // Legacy config for backward compatibility
  await prisma.scaleBarcodeConfig.create({
    data: {
      storeId: franchiseStore.id,
      name: 'Default Scale Config',
      prefix: '22',
      pluStart: 0,
      pluLength: 5,
      weightStart: 5,
      weightLength: 5,
      weightDecimal: 2,
      checksumType: 'NONE',
      isActive: false, // Set to inactive, use Machine Barcode Format instead
    },
  });

  // Create Sample Customer
  const customer = await prisma.customer.create({
    data: {
      storeId: franchiseStore.id,
      name: 'John Doe',
      phone: '5555555555',
      email: 'john@example.com',
    },
  });

  await prisma.customerAddress.create({
    data: {
      customerId: customer.id,
      label: 'Home',
      line1: '123 Main St',
      line2: 'Apt 4B',
      city: 'Mumbai',
      state: 'Maharashtra',
      zip: '400001',
    },
  });

  console.log('Seed completed!');
  console.log('\nTest Credentials:');
  console.log('Owner: 9999999999 / owner123');
  console.log('Manager: 8888888888 / manager123');
  console.log('Cashier: 7777777777 / cashier123');
  console.log('Driver: 6666666666 / driver123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

