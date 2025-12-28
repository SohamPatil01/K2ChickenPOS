// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { z } from 'zod';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';

const productMasterSchema = z.object({
  productId: z.string(),
  productType: z.enum(['WHOLE_CHICKEN', 'BREAST', 'LEG', 'WINGS', 'LIVER', 'GIZZARD', 'SKIN', 'MINCE', 'CUSTOM_CUT']),
  expectedYieldPercent: z.number().min(0).max(100).optional(),
  wastageTolerancePercent: z.number().min(0).max(100).optional(),
  taxCategory: z.string().optional(),
  hqLockedPrice: z.number().optional(),
  isHQLocked: z.boolean().optional(),
});

export async function hqProductMasterRoutes(fastify: FastifyInstance) {
  // Get product master by productId (for store users to check HQ locks)
  fastify.get(
    '/product-master',
    { preHandler: [fastify.authenticate] },
    async (request: any, reply: FastifyReply) => {
      try {
        const {
        
        if (!productId) {
          reply.code(400).send({ error: 'productId is required' });
          return;
        }

        // Try to find product master, but handle cases where product or category might not exist
        const productMaster = await prisma.productMaster.findFirst({
          where: { productId },
        });

        // If no product master found, return empty array (not an error)
        if (!productMaster) {
          return [];
        }

        // Try to get product and category separately to avoid relation errors
        let product = null;
        let category = null;
        
        try {
          product = await prisma.product.findUnique({
            where: { id: productId },
            select: {
              id: true,
              name: true,
              sku: true,
              plu: true,
              categoryId: true,
            },
          });

          if (product?.categoryId) {
            try {
              category = await prisma.category.findUnique({
                where: { id: product.categoryId },
              });
            } catch (catError) {
              // Category might not exist, that's okay
              console.warn('Category not found for product:', product.categoryId);
            }
          }
        } catch (prodError) {
          // Product might not exist, that's okay - we still return the product master
          console.warn('Product not found:', productId);
        }

        // Return product master with product and category if available
        return [{
          ...productMaster,
          product: product ? {
            ...product,
            category: category,
          } : null,
        }];
      } catch (error: any) {
        console.error('Failed to load product master:', error);
        console.error('Error details:', error.message, error.stack);
        reply.code(500).send({ 
          error: 'Failed to load product master',
          details: error.message 
        });
      }
    }
  );

  // Get all product masters
  fastify.get(
    '/product-masters',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const {

        const where: any = { ownerStoreId };
        if (productType) {
          where.productType = productType;
        }

        // Fetch product masters first
        const productMasters = await prisma.productMaster.findMany({
          where,
          orderBy: { createdAt: 'desc' },
        });

        // Fetch product and category data separately to avoid relation errors
        const productMastersWithDetails = await Promise.all(
          productMasters.map(async (master) => {
            let product = null;
            let category = null;

            try {
              product = await prisma.product.findUnique({
                where: { id: master.productId },
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  plu: true,
                  categoryId: true,
                },
              });

              if (product?.categoryId) {
                try {
                  category = await prisma.category.findUnique({
                    where: { id: product.categoryId },
                  });
                } catch (catError) {
                  console.warn('Category not found for product:', product.categoryId);
                }
              }
            } catch (prodError) {
              console.warn('Product not found:', master.productId);
            }

            return {
              ...master,
              product: product ? {
                ...product,
                category: category,
              } : null,
            };
          })
        );

        return productMastersWithDetails;
      } catch (error: any) {
        console.error('Failed to load product masters:', error);
        console.error('Error details:', error.message, error.stack);
        reply.code(500).send({ 
          error: 'Failed to load product masters',
          details: error.message 
        });
      }
    }
  );

  // Get single product master
  fastify.get(
    '/product-masters/:id',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const { id } = (request.params as any);

        const productMaster = await prisma.productMaster.findUnique({
          where: { id },
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        });

        if (!productMaster || productMaster.ownerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Product master not found' });
          return;
        }

        return productMaster;
      } catch (error: any) {
        console.error('Failed to load product master:', error);
        reply.code(500).send({ error: 'Failed to load product master' });
      }
    }
  );

  // Create product master
  fastify.post(
    '/product-masters',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const data = productMasterSchema.parse(request.body as any);

        // Verify product belongs to owner
        const product = await prisma.product.findUnique({
          where: { id: data.productId },
        });

        if (!product || product.ownerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Product not found' });
          return;
        }

        // Check if product master already exists
        const existing = await prisma.productMaster.findUnique({
          where: { productId: data.productId },
        });

        if (existing) {
          reply.code(400).send({ error: 'Product master already exists for this product' });
          return;
        }

        const productMaster = await prisma.productMaster.create({
          data: {
            ownerStoreId,
            productId: data.productId,
            productType: data.productType,
            expectedYieldPercent: data.expectedYieldPercent || 100.0,
            wastageTolerancePercent: data.wastageTolerancePercent || 5.0,
            taxCategory: data.taxCategory,
            hqLockedPrice: data.hqLockedPrice,
            isHQLocked: data.isHQLocked || false,
          },
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        });

        return productMaster;
      } catch (error: any) {
        console.error('Failed to create product master:', error);
        reply.code(500).send({ error: 'Failed to create product master' });
      }
    }
  );

  // Update product master
  fastify.put(
    '/product-masters/:id',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const { id } = (request.params as any);
        const data = productMasterSchema.partial().parse(request.body as any);

        const productMaster = await prisma.productMaster.findUnique({
          where: { id },
        });

        if (!productMaster || productMaster.ownerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Product master not found' });
          return;
        }

        const updated = await prisma.productMaster.update({
          where: { id },
          data,
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to update product master:', error);
        reply.code(500).send({ error: 'Failed to update product master' });
      }
    }
  );

  // Delete product master
  fastify.delete(
    '/product-masters/:id',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const { id } = (request.params as any);

        const productMaster = await prisma.productMaster.findUnique({
          where: { id },
        });

        if (!productMaster || productMaster.ownerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Product master not found' });
          return;
        }

        await prisma.productMaster.delete({
          where: { id },
        });

        return { message: 'Product master deleted successfully' };
      } catch (error: any) {
        console.error('Failed to delete product master:', error);
        reply.code(500).send({ error: 'Failed to delete product master' });
      }
    }
  );
}

