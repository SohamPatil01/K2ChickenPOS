// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { getUser, requireRole } from '../utils/auth.js';

interface QueryParams {
  search?: string;
  categoryId?: string;
}

export async function productRoutes(fastify: FastifyInstance) {

  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const { search, categoryId } = (request.query as any);
      
      // Get authenticated user's store
      const user = getUser(request);
      const store = await prisma.store.findUnique({ 
        where: { id: user.storeId },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });
      
      if (!store) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      const storeId = user.storeId;
      const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
      if (!ownerStoreId) {
        reply.code(400).send({ error: 'Owner store not found' });
        return;
      }
      
      console.log(`[Products List] Fetching products for storeId: ${storeId}, ownerStoreId: ${ownerStoreId}`);

      const where: any = {
        ownerStoreId,
        isActive: true,
      };

      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { plu: { contains: search, mode: 'insensitive' } },
        ];
      }

      const products = await prisma.product.findMany({
        where,
        include: {
          category: true,
          storeProductPrices: {
            where: {
              storeId,
              isActive: true,
            },
            orderBy: {
              effectiveFrom: 'desc',
            },
            take: 1,
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      const result = products.map((p: any) => {
        const pricePerUnit = p.storeProductPrices[0]?.pricePerUnit || 0;
        if (pricePerUnit === 0 && p.storeProductPrices.length === 0) {
          console.log(`[Products List] Product ${p.name} (${p.id}) has no active price for storeId: ${storeId}`);
        }
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          plu: p.plu,
          categoryId: p.categoryId,
          categoryName: p.category?.name || '',
          unitType: p.unitType,
          taxRate: p.taxRate,
          pricePerUnit,
          imageUrl: p.imageUrl,
          isActive: p.isActive,
        };
      });

      console.log(`[Products List] Returning ${result.length} products for storeId: ${storeId}`);
      return result;
    } catch (error: any) {
      console.error('Failed to get products:', error);
      reply.code(500).send({ error: 'Failed to get products', details: error.message });
    }
  });

  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const user = getUser(request);
      const userStore = await prisma.store.findUnique({ 
        where: { id: user.storeId },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });
      
      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      const storeId = user.storeId;

      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          storeProductPrices: {
            where: {
              storeId,
              isActive: true,
            },
            orderBy: {
              effectiveFrom: 'desc',
            },
            take: 1,
          },
        },
      });

      if (!product) {
        reply.code(404).send({ error: 'Product not found' });
        return;
      }

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        plu: product.plu,
        categoryId: product.categoryId,
        categoryName: product.category?.name || '',
        unitType: product.unitType,
        taxRate: product.taxRate,
        pricePerUnit: product.storeProductPrices[0]?.pricePerUnit || 0,
        imageUrl: product.imageUrl,
        isActive: product.isActive,
      };
    } catch (error: any) {
      console.error('Failed to get product:', error);
      reply.code(500).send({ error: 'Failed to get product', details: error.message });
    }
  });

  fastify.get('/categories', async (request: FastifyRequest, reply: FastifyReply) => {
    // Get default store for now (since auth is disabled)
    const store = await prisma.store.findFirst({ 
      where: { type: 'OWNER' },
      select: { id: true, name: true, type: true, parentOwnerStoreId: true }
    });

    if (!store) {
      reply.code(404).send({ error: 'Store not found' });
      return;
    }

    const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
    if (!ownerStoreId) {
      reply.code(400).send({ error: 'Owner store not found' });
      return;
    }

    const categories = await prisma.category.findMany({
      where: { ownerStoreId },
      orderBy: { sortOrder: 'asc' },
    });

    return categories;
  });

  // Product CRUD routes
  fastify.post('/', { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] }, async (request: any, reply: FastifyReply) => {
    const body = request.body as any;
    const { sku, plu, name, categoryId, unitType, taxRate, imageUrl } = body || {};
    
    try {
      // Validate required fields
      if (!sku || !plu || !name || !categoryId || !unitType) {
        reply.code(400).send({ error: 'Missing required fields: sku, plu, name, categoryId, unitType are required' });
        return;
      }

      // Get user's store
      const user = getUser(request);
      const userStore = await prisma.store.findUnique({ 
        where: { id: user.storeId },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });

      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      const ownerStoreId = userStore.type === 'OWNER' ? userStore.id : userStore.parentOwnerStoreId;
      if (!ownerStoreId) {
        reply.code(400).send({ error: 'Owner store not found' });
        return;
      }

      const product = await prisma.product.create({
        data: {
          ownerStoreId,
          sku,
          plu,
          name,
          categoryId,
          unitType,
          taxRate: taxRate || 0,
          imageUrl: imageUrl || null,
        },
        include: { category: true },
      });

      return product;
    } catch (error: any) {
      console.error('Failed to create product:', error);
      if (error.code === 'P2002') {
        // Prisma unique constraint violation
        const target = error.meta?.target;
        let errorMessage = 'SKU or PLU already exists';
        
        if (Array.isArray(target)) {
          if (target.includes('sku') && sku) {
            errorMessage = `SKU "${sku}" already exists. Please use a different SKU.`;
          } else if (target.includes('plu') && plu) {
            errorMessage = `PLU "${plu}" already exists. Please use a different PLU.`;
          }
        }
        
        reply.code(400).send({ 
          error: errorMessage,
          code: 'DUPLICATE_SKU_OR_PLU',
          field: Array.isArray(target) && target.includes('sku') ? 'sku' : Array.isArray(target) && target.includes('plu') ? 'plu' : null,
        });
        return;
      }
      reply.code(500).send({ error: 'Failed to create product', details: error.message });
    }
  });

  fastify.put('/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { id } = (request.params as any);
    const updates = request.body as any;
    const { sku, plu } = updates || {};
    
    try {

      // Get the existing product to check current SKU/PLU
      const existingProduct = await prisma.product.findUnique({
        where: { id },
        select: { id: true, sku: true, plu: true, ownerStoreId: true },
      });

      if (!existingProduct) {
        reply.code(404).send({ error: 'Product not found' });
        return;
      }

      // Get user's store
      const user = getUser(request);
      const userStore = await prisma.store.findUnique({ 
        where: { id: user.storeId },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });

      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      const ownerStoreId = userStore.type === 'OWNER' ? userStore.id : userStore.parentOwnerStoreId;
      if (!ownerStoreId) {
        reply.code(400).send({ error: 'Owner store not found' });
        return;
      }

      // Verify product belongs to user's store
      if (existingProduct.ownerStoreId !== ownerStoreId) {
        reply.code(403).send({ error: 'Access denied' });
        return;
      }

      // Check for SKU/PLU conflicts only if they're being changed
      if (sku && sku !== existingProduct.sku) {
        const skuExists = await prisma.product.findFirst({
          where: {
            ownerStoreId,
            sku,
            id: { not: id }, // Exclude current product
          },
        });

        if (skuExists) {
          reply.code(400).send({
            error: `SKU "${sku}" already exists. Please use a different SKU.`,
            code: 'DUPLICATE_SKU',
            field: 'sku',
          });
          return;
        }
      }

      if (plu && plu !== existingProduct.plu) {
        const pluExists = await prisma.product.findFirst({
          where: {
            ownerStoreId,
            plu,
            id: { not: id }, // Exclude current product
          },
        });

        if (pluExists) {
          reply.code(400).send({
            error: `PLU "${plu}" already exists. Please use a different PLU.`,
            code: 'DUPLICATE_PLU',
            field: 'plu',
          });
          return;
        }
      }

      // Update the product
      const product = await prisma.product.update({
        where: { id },
        data: updates,
        include: { category: true },
      });

      return product;
    } catch (error: any) {
      console.error('Failed to update product:', error);
      if (error.code === 'P2002') {
        // Prisma unique constraint violation (fallback)
        const target = error.meta?.target;
        let errorMessage = 'SKU or PLU already exists';
        
        if (Array.isArray(target)) {
          if (target.includes('sku') && sku) {
            errorMessage = `SKU "${sku}" already exists. Please use a different SKU.`;
          } else if (target.includes('plu') && plu) {
            errorMessage = `PLU "${plu}" already exists. Please use a different PLU.`;
          }
        }
        
        reply.code(400).send({
          error: errorMessage,
          code: 'DUPLICATE_SKU_OR_PLU',
          field: Array.isArray(target) && target.includes('sku') ? 'sku' : Array.isArray(target) && target.includes('plu') ? 'plu' : null,
        });
        return;
      }
      reply.code(500).send({ error: 'Failed to update product', details: error.message });
    }
  });

  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { id } = (request.params as any);
    
    console.log('DELETE /api/v1/products/:id - Product ID:', id);
    
    try {
      const user = getUser(request);
      console.log('DELETE - User:', user.userId, 'Store:', user.storeId);
      
      // Check if product exists and belongs to user's store
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          ownerStore: {
            select: {
              id: true,
              name: true,
              type: true,
            }
          },
        },
      });

      console.log('DELETE - Product found:', product ? 'Yes' : 'No');
      
      if (!product) {
        console.log('DELETE - Product not found with ID:', id);
        reply.code(404).send({ error: 'Product not found', productId: id });
        return;
      }

      // Verify user has access to this product's store
      const store = await prisma.store.findUnique({ where: { id: user.storeId }, select: { id: true, name: true, type: true, parentOwnerStoreId: true } });
      if (!store) {
        console.log('DELETE - Store not found:', user.storeId);
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
      console.log('DELETE - Owner Store ID:', ownerStoreId, 'Product Owner Store ID:', product.ownerStoreId);
      
      if (product.ownerStoreId !== ownerStoreId) {
        console.log('DELETE - Access denied: Product belongs to different store');
        reply.code(403).send({ error: 'Access denied' });
        return;
      }

      // Actually delete the product (cascade will handle related records)
      console.log('DELETE - Attempting to delete product:', id);
      await prisma.product.delete({
        where: { id },
      });

      console.log('DELETE - Product deleted successfully:', id);
      return { success: true, message: 'Product deleted successfully' };
    } catch (error: any) {
      console.error('DELETE - Failed to delete product:', error);
      console.error('DELETE - Error code:', error.code);
      console.error('DELETE - Error message:', error.message);
      
      if (error.code === 'P2025') {
        reply.code(404).send({ error: 'Product not found', productId: id });
        return;
      }
      reply.code(500).send({ error: 'Failed to delete product', details: error.message });
    }
  });

  // Price management
  fastify.post('/:id/price', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const { pricePerUnit, effectiveFrom } = request.body as any;
      const user = getUser(request);
      const storeId = (user as any).storeId;

      if (!storeId) {
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }

      if (!pricePerUnit || pricePerUnit <= 0) {
        reply.code(400).send({ error: 'Valid price per unit is required' });
        return;
      }

      // Verify product exists
      const product = await prisma.product.findUnique({
        where: { id },
      });

      if (!product) {
        reply.code(404).send({ error: 'Product not found' });
        return;
      }

      // Deactivate old prices
      await prisma.storeProductPrice.updateMany({
        where: {
          storeId,
          productId: id,
          isActive: true,
        },
        data: { isActive: false },
      });

      // Create new price
      const price = await prisma.storeProductPrice.create({
        data: {
          storeId,
          productId: id,
          pricePerUnit: parseFloat(pricePerUnit),
          effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        },
      });

      return price;
    } catch (error: any) {
      console.error('Failed to set product price:', error);
      reply.code(500).send({ error: 'Failed to set product price', details: error.message });
    }
  });

  // Category management
  fastify.post('/categories', async (request: any, reply: FastifyReply) => {
    const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
    // Get default store for now (since auth is disabled)
    const store = await prisma.store.findFirst({ 
      where: { type: 'OWNER' },
      select: { id: true, name: true, type: true, parentOwnerStoreId: true }
    });

    if (!store) {
      reply.code(404).send({ error: 'Store not found' });
      return;
    }

    const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
    if (!ownerStoreId) {
      reply.code(400).send({ error: 'Owner store not found' });
      return;
    }

    try {
      const category = await prisma.category.create({
        data: {
          ownerStoreId,
          name,
          sortOrder: sortOrder || 0,
        },
      });

      return category;
    } catch (error: any) {
      if (error.code === 'P2002') {
        reply.code(400).send({ error: 'Category name already exists' });
        return;
      }
      reply.code(500).send({ error: 'Failed to create category' });
    }
  });

  fastify.put('/categories/:id', async (request: any, reply: FastifyReply) => {
    const { id } = (request.params as any);
    const updates = request.body as any

    try {
      const category = await prisma.category.update({
        where: { id },
        data: updates,
      });

      return category;
    } catch (error) {
      reply.code(500).send({ error: 'Failed to update category' });
    }
  });

  fastify.delete('/categories/:id', async (request: any, reply: FastifyReply) => {
    const { id } = (request.params as any);
    try {
      await prisma.category.delete({
        where: { id },
      });

      return { success: true };
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete category' });
    }
  });
}

