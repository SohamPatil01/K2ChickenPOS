#!/usr/bin/env tsx
/**
 * Script to reset all user passwords to default seed values
 * Usage: npx tsx scripts/reset-passwords.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const defaultPasswords = {
  OWNER: '123456',
  MANAGER: '234567',
  CASHIER: '345678',
  DRIVER: '456789',
};

async function resetPasswords() {
  try {
    console.log('🔄 Resetting user passwords to defaults...\n');

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
      },
    });

    console.log(`Found ${users.length} users to update\n`);

    for (const user of users) {
      const defaultPassword = defaultPasswords[user.role as keyof typeof defaultPasswords];
      
      if (!defaultPassword) {
        console.log(`⚠️  Skipping ${user.name} (${user.phone}) - Unknown role: ${user.role}`);
        continue;
      }

      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      console.log(`✅ Reset password for ${user.name} (${user.phone}) - Role: ${user.role} - Password: ${defaultPassword}`);
    }

    console.log('\n✨ All passwords reset successfully!');
    console.log('\nDefault passwords:');
    console.log('  Owner:   123456');
    console.log('  Manager: 234567');
    console.log('  Cashier: 345678');
    console.log('  Driver:  456789');
  } catch (error) {
    console.error('❌ Error resetting passwords:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetPasswords();

