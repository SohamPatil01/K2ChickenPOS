// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';

interface QueryParams {
  search?: string;
  categoryId?: string;
}

export async function productRoutes(fastify: FastifyInstance) {

  fastify.get('/', async (request: any, reply: FastifyReply) => {
    const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
    // Get default store for now (since auth is disabled)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const storeId = store?.id || '';

    if (!store) {
      reply.code(404).send({ error: 'Store not found' });
      return;
    }

    const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
    if (!ownerStoreId) {
      reply.code(400).send({ error: 'Owner store not found' });
      return;
    }

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

    const result = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      plu: p.plu,
      categoryId: p.categoryId,
      categoryName: p.category?.name || '',
      unitType: p.unitType,
      taxRate: p.taxRate,
      pricePerUnit: p.storeProductPrices[0]?.pricePerUnit || 0,
      imageUrl: p.imageUrl,
      isActive: p.isActive,
    }));

    return result;
  });

  fastify.get('/:id', async (request: any, reply: FastifyReply) => {
    const { id } = (request.params as any);
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const storeId = store?.id || '';

    try {
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
    } catch (error) {
      reply.code(500).send({ error: 'Failed to get product' });
    }
  });

  fastify.get('/categories', async (request: FastifyRequest, reply: FastifyReply) => {
    // Get default store for now (since auth is disabled)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });

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
  fastify.post('/', async (request: any, reply: FastifyReply) => {
    const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
    // Get default store for now (since auth is disabled)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });

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
      if (error.code === 'P2002') {
        reply.code(400).send({ error: 'SKU or PLU already exists' });
        return;
      }
      reply.code(500).send({ error: 'Failed to create product' });
    }
  });

  fastify.put('/:id', async (request: any, reply: FastifyReply) => {
    const { id } = (request.params as any);
    const updates = request.body as any;

    try {
      const product = await prisma.product.update({
        where: { id },
        data: updates,
        include: { category: true },
      });

      return product;
    } catch (error) {
      reply.code(500).send({ error: 'Failed to update product' });
    }
  });

  fastify.delete('/:id', async (request: any, reply: FastifyReply) => {
    const { id } = (request.params as any);
    try {
      await prisma.product.update({
        where: { id },
        data: { isActive: false },
      });

      return { success: true };
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete product' });
    }
  });

  // Price management
  fastify.post('/:id/price', async (request: any, reply: FastifyReply) => {
    const { id } = (request.params as any);
    const { id } = (request.params as any);
    // Get default store for now (since auth is disabled)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const storeId = store?.id || '';

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
        pricePerUnit,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      },
    });

    return price;
  });

  // Category management
  fastify.post('/categories', async (request: any, reply: FastifyReply) => {
    const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
    // Get default store for now (since auth is disabled)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });

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

