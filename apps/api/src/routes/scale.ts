// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { scaleBarcodeConfigSchema, parseBarcodeSchema } from '@azela-pos/shared';
import { parseScaleBarcode } from '../utils/barcode.js';
import { getUser } from '../utils/auth.js';

export async function scaleRoutes(fastify: FastifyInstance) {

  fastify.get('/config', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const storeId = (getUser(request) as any).storeId;

    const configs = await prisma.scaleBarcodeConfig.findMany({
      where: {
        storeId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return configs;
  });

  fastify.post('/config', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = scaleBarcodeConfigSchema.parse(request.body as any);
      const storeId = (getUser(request) as any).storeId;

      const config = await prisma.scaleBarcodeConfig.create({
        data: {
          storeId,
          name: data.name,
          prefix: data.prefix,
          pluStart: data.pluStart,
          pluLength: data.pluLength,
          weightStart: data.weightStart,
          weightLength: data.weightLength,
          weightDecimal: data.weightDecimal,
          priceStart: data.priceStart,
          priceLength: data.priceLength,
          priceDecimal: data.priceDecimal,
          checksumType: data.checksumType,
          isActive: data.isActive,
        },
      });

      return config;
    } catch (error: any) {
      console.error('Error creating scale barcode config:', error);
      if (error.name === 'ZodError') {
        reply.code(400).send({ 
          error: 'Validation error', 
          details: error.errors 
        });
        return;
      }
      if (error.code === 'P2002') {
        reply.code(400).send({ error: 'Configuration with this name already exists for this store' });
        return;
      }
      reply.code(500).send({ error: 'Failed to create configuration', message: error.message });
    }
  });

  fastify.put('/config/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { id } = (request.params as any);
    const data = scaleBarcodeConfigSchema.parse(request.body as any);
    const storeId = (getUser(request) as any).storeId;

    // Verify config belongs to user's store
    const existing = await prisma.scaleBarcodeConfig.findUnique({
      where: { id },
    });

    if (!existing || existing.storeId !== storeId) {
      reply.code(404).send({ error: 'Configuration not found' });
      return;
    }

    const config = await prisma.scaleBarcodeConfig.update({
      where: { id },
      data,
    });

    return config;
  });

  fastify.delete('/config/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { id } = (request.params as any);
    const storeId = (getUser(request) as any).storeId;

    // Verify config belongs to user's store
    const existing = await prisma.scaleBarcodeConfig.findUnique({
      where: { id },
    });

    if (!existing || existing.storeId !== storeId) {
      reply.code(404).send({ error: 'Configuration not found' });
      return;
    }

    await prisma.scaleBarcodeConfig.delete({
      where: { id },
    });

    return { success: true };
  });

  fastify.post('/parse', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { barcode, configId } = parseBarcodeSchema.parse(request.body as any);
    const storeId = (getUser(request) as any).storeId;

    const result = await parseScaleBarcode(barcode, storeId, configId);

    if (!result) {
      // Clean barcode for lookup
      const cleanBarcode = barcode.trim().replace(/\s/g, '');
      
      // Check if product exists by SKU to provide better error message
      const productBySku = await prisma.product.findFirst({
        where: {
          OR: [
            { sku: cleanBarcode },
            { sku: barcode },
            { plu: cleanBarcode },
            { plu: barcode }
          ],
          isActive: true,
        },
        include: {
          storeProductPrices: {
            where: {
              storeId,
              isActive: true,
            },
            take: 1,
          },
        },
      });

      if (productBySku) {
        if (productBySku.storeProductPrices.length === 0) {
          reply.code(400).send({ 
            error: 'Product found but no price set for this store',
            productId: productBySku.id,
            productName: productBySku.name,
            sku: productBySku.sku,
            plu: productBySku.plu,
            suggestion: 'Set a price for this product in the current store'
          });
          return;
        } else {
          // Product exists and has price, but parseScaleBarcode didn't find it
          // This shouldn't happen, but if it does, return the product info
          reply.code(400).send({ 
            error: 'Product found but barcode parsing failed',
            productId: productBySku.id,
            productName: productBySku.name,
            sku: productBySku.sku,
            plu: productBySku.plu,
            suggestion: 'Try using the product directly from the product list'
          });
          return;
        }
      }

      // Check if scale config exists but doesn't match
      const config = await prisma.scaleBarcodeConfig.findFirst({
        where: {
          storeId,
          isActive: true,
        },
      });

      // If barcode doesn't start with scale prefix, it's a standard product barcode
      // Return null (not an error) so frontend can try direct SKU lookup
      if (config && !cleanBarcode.startsWith(config.prefix) && !barcode.startsWith(config.prefix)) {
        // This is a standard product barcode, not a scale barcode
        // Return null so frontend can handle it
        reply.code(200).send(null);
        return;
      }

      if (config) {
        reply.code(400).send({ 
          error: 'Failed to parse scale barcode',
          message: 'Barcode format does not match scale barcode configuration',
          barcode,
          configName: config.name,
          configPrefix: config.prefix
        });
        return;
      }

      // No config and no product found - return null for frontend to handle
      reply.code(200).send(null);
      return;
    }

    return result;
  });
}

