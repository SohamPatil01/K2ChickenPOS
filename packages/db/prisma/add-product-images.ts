import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

// Map product names to image URLs
// Using Lorem Picsum with specific seeds for consistent food-related images
// These are placeholder images that work reliably without CORS issues
const productImageMap: Record<string, string> = {
  // Chicken cuts - using seeded images for consistency
  'breast boneless': 'https://picsum.photos/seed/chicken-breast-boneless-001/400/400',
  'breast': 'https://picsum.photos/seed/chicken-breast-002/400/400',
  'chicken breast': 'https://picsum.photos/seed/chicken-breast-003/400/400',
  'drumstick': 'https://picsum.photos/seed/chicken-drumstick-001/400/400',
  'leg': 'https://picsum.photos/seed/chicken-leg-001/400/400',
  'chicken legs': 'https://picsum.photos/seed/chicken-legs-002/400/400',
  'wing': 'https://picsum.photos/seed/chicken-wing-001/400/400',
  'wings': 'https://picsum.photos/seed/chicken-wings-002/400/400',
  'thigh': 'https://picsum.photos/seed/chicken-thigh-001/400/400',
  'whole chicken': 'https://picsum.photos/seed/whole-chicken-001/400/400',
  'chicken': 'https://picsum.photos/seed/chicken-main-001/400/400',
  'carcus': 'https://picsum.photos/seed/chicken-carcus-001/400/400',
  'carcass': 'https://picsum.photos/seed/chicken-carcass-002/400/400',
  'gizzard': 'https://picsum.photos/seed/chicken-gizzard-001/400/400',
  'liver': 'https://picsum.photos/seed/chicken-liver-001/400/400',
  'lollipop': 'https://picsum.photos/seed/chicken-lollipop-001/400/400',
  'hot tandoor': 'https://picsum.photos/seed/tandoor-chicken-001/400/400',
  'tandoor': 'https://picsum.photos/seed/tandoor-002/400/400',
  
  // Eggs
  'egg': 'https://picsum.photos/seed/egg-single-001/400/400',
  'eggs': 'https://picsum.photos/seed/eggs-multiple-001/400/400',
  
  // Default chicken image
  'default': 'https://picsum.photos/seed/chicken-default-001/400/400',
};

// Function to find matching image URL for a product name
function getImageUrl(productName: string): string | null {
  const normalizedName = productName.toLowerCase().trim();
  
  // Try exact match first
  if (productImageMap[normalizedName]) {
    return productImageMap[normalizedName];
  }
  
  // Try partial matches
  for (const [key, url] of Object.entries(productImageMap)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return url;
    }
  }
  
  // Check for common keywords
  if (normalizedName.includes('chicken')) {
    return productImageMap['chicken'];
  }
  
  if (normalizedName.includes('egg')) {
    return productImageMap['egg'];
  }
  
  // Return default if no match
  return productImageMap['default'];
}

async function main() {
  console.log('🖼️  Adding product images based on product names...\n');

  try {
    // Get all products
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
      },
    });

    console.log(`📦 Found ${products.length} products\n`);

    if (products.length === 0) {
      console.log('✅ No products to update.');
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const product of products) {
      try {
        // Force update - remove this check to update all products
        // if (product.imageUrl) {
        //   console.log(`⏭️  Skipping "${product.name}" - already has image`);
        //   skippedCount++;
        //   continue;
        // }

        // Get image URL based on product name
        const imageUrl = getImageUrl(product.name);

        if (!imageUrl) {
          console.log(`⚠️  No image found for "${product.name}"`);
          skippedCount++;
          continue;
        }

        // Update product with image URL
        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl },
        });

        console.log(`✅ Updated "${product.name}" with image`);
        updatedCount++;
      } catch (error: any) {
        console.error(`❌ Error updating "${product.name}":`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   - Updated: ${updatedCount} products`);
    console.log(`   - Skipped: ${skippedCount} products`);
    console.log(`   - Errors: ${errorCount} products`);
    console.log('\n✨ Product images added successfully!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
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

