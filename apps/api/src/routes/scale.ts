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
      // Check if product exists by SKU to provide better error message
      const productBySku = await prisma.product.findFirst({
        where: {
          sku: barcode,
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
            sku: productBySku.sku
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

      if (config && !barcode.startsWith(config.prefix)) {
        reply.code(400).send({ 
          error: 'Barcode format does not match scale barcode configuration',
          message: `Barcode "${barcode}" does not start with prefix "${config.prefix}". This might be a standard product barcode (EAN-13) that should be looked up by SKU directly.`,
          barcode,
          configPrefix: config.prefix,
          suggestion: 'Ensure product SKU matches the barcode exactly'
        });
        return;
      }

      if (config) {
        reply.code(400).send({ 
          error: 'Failed to parse barcode',
          message: 'Barcode configuration exists but barcode format does not match, or product not found',
          barcode,
          configName: config.name
        });
        return;
      }

      reply.code(400).send({ 
        error: 'Failed to parse barcode',
        message: 'No barcode configuration exists and product not found by SKU',
        barcode,
        suggestion: 'For standard product barcodes (EAN-13), ensure product SKU matches the barcode exactly'
      });
      return;
    }

    return result;
  });
}

