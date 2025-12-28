#!/usr/bin/env node
// Script to prepare workspace packages for Vercel deployment
import { mkdir, cp, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_DIR = join(__dirname, '..');
const ROOT_DIR = join(API_DIR, '../..');
const PACKAGES_DIR = join(ROOT_DIR, 'packages');

async function copyRecursive(src, dest) {
  // Use cp -r for recursive copy (works on Unix-like systems)
  try {
    await execSync(`cp -r "${src}" "${dest}"`, { stdio: 'inherit' });
  } catch (error) {
    // Fallback: try using Node.js fs methods
    const { readdir, stat, mkdir: mkdirSync, copyFile } = await import('fs/promises');
    const { join } = await import('path');
    
    const stats = await stat(src);
    if (stats.isDirectory()) {
      await mkdir(dest, { recursive: true });
      const entries = await readdir(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);
        if (entry.isDirectory()) {
          await copyRecursive(srcPath, destPath);
        } else {
          await copyFile(srcPath, destPath);
        }
      }
    } else {
      await copyFile(src, dest);
    }
  }
}

async function preparePackages() {
  const nodeModulesDir = join(API_DIR, 'node_modules');
  const azelaPosDir = join(nodeModulesDir, '@azela-pos');

  // Create node_modules/@azela-pos directory if it doesn't exist
  if (!existsSync(azelaPosDir)) {
    await mkdir(azelaPosDir, { recursive: true });
  }

  // Copy db package
  const dbSource = join(PACKAGES_DIR, 'db');
  const dbTarget = join(azelaPosDir, 'db');
  
  if (existsSync(dbTarget)) {
    await rm(dbTarget, { recursive: true, force: true });
  }
  await mkdir(dbTarget, { recursive: true });

  // Copy the dist directory
  const dbDist = join(dbSource, 'dist');
  if (existsSync(dbDist)) {
    await copyRecursive(dbDist, join(dbTarget, 'dist'));
  }
  
  // Copy package.json
  if (existsSync(join(dbSource, 'package.json'))) {
    await copyRecursive(join(dbSource, 'package.json'), join(dbTarget, 'package.json'));
  }
  
  // Copy prisma directory if it exists (needed for Prisma client)
  const prismaDir = join(dbSource, 'prisma');
  if (existsSync(prismaDir)) {
    await copyRecursive(prismaDir, join(dbTarget, 'prisma'));
  }

  // Copy shared package
  const sharedSource = join(PACKAGES_DIR, 'shared');
  const sharedTarget = join(azelaPosDir, 'shared');
  
  if (existsSync(sharedTarget)) {
    await rm(sharedTarget, { recursive: true, force: true });
  }
  await mkdir(sharedTarget, { recursive: true });

  const sharedDist = join(sharedSource, 'dist');
  if (existsSync(sharedDist)) {
    await copyRecursive(sharedDist, join(sharedTarget, 'dist'));
  }
  
  // Copy package.json
  if (existsSync(join(sharedSource, 'package.json'))) {
    await copyRecursive(join(sharedSource, 'package.json'), join(sharedTarget, 'package.json'));
  }

  console.log('✓ Workspace packages prepared for Vercel');
}

preparePackages().catch((error) => {
  console.error('Error preparing packages:', error);
  process.exit(1);
});

