#!/usr/bin/env node
// Script to prepare workspace packages for Vercel deployment
import { mkdir, cp, symlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_DIR = __dirname;
const ROOT_DIR = join(API_DIR, '../..');
const PACKAGES_DIR = join(ROOT_DIR, 'packages');

async function preparePackages() {
  const nodeModulesDir = join(API_DIR, 'node_modules');
  const azelaPosDir = join(nodeModulesDir, '@azela-pos');

  // Create node_modules/@azela-pos directory if it doesn't exist
  if (!existsSync(azelaPosDir)) {
    await mkdir(azelaPosDir, { recursive: true });
  }

  // Copy or symlink db package
  const dbSource = join(PACKAGES_DIR, 'db');
  const dbTarget = join(azelaPosDir, 'db');
  
  if (existsSync(dbTarget)) {
    // Remove existing link/copy
    const { rm } = await import('fs/promises');
    await rm(dbTarget, { recursive: true, force: true });
  }

  // Copy the dist directory and package.json
  const dbDist = join(dbSource, 'dist');
  if (existsSync(dbDist)) {
    const dbTargetDist = join(dbTarget, 'dist');
    await mkdir(dbTargetDist, { recursive: true });
    await cp(dbDist, dbTargetDist, { recursive: true });
    
    // Copy package.json
    await cp(join(dbSource, 'package.json'), join(dbTarget, 'package.json'));
    
    // Copy prisma directory if it exists (needed for Prisma client)
    const prismaDir = join(dbSource, 'prisma');
    if (existsSync(prismaDir)) {
      await cp(prismaDir, join(dbTarget, 'prisma'), { recursive: true });
    }
  }

  // Copy or symlink shared package
  const sharedSource = join(PACKAGES_DIR, 'shared');
  const sharedTarget = join(azelaPosDir, 'shared');
  
  if (existsSync(sharedTarget)) {
    const { rm } = await import('fs/promises');
    await rm(sharedTarget, { recursive: true, force: true });
  }

  const sharedDist = join(sharedSource, 'dist');
  if (existsSync(sharedDist)) {
    const sharedTargetDist = join(sharedTarget, 'dist');
    await mkdir(sharedTargetDist, { recursive: true });
    await cp(sharedDist, sharedTargetDist, { recursive: true });
    
    // Copy package.json
    await cp(join(sharedSource, 'package.json'), join(sharedTarget, 'package.json'));
  }

  console.log('Workspace packages prepared for Vercel');
}

preparePackages().catch(console.error);

