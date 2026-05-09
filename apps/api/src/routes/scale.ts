// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { normalizeBarcodeForLookup, scaleBarcodeConfigSchema, parseBarcodeSchema } from '@azela-pos/shared';
import {
  fetchProductByWhitespaceNormalizedSkuPlu,
  parseScaleBarcode,
  scaleBarcodeConfigScopeIdsFromStore,
} from '../utils/barcode.js';
import { getUser } from '../utils/auth.js';

export async function scaleRoutes(fastify: FastifyInstance) {

  fastify.get('/config', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const storeId = (getUser(request) as any).storeId;

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, type: true, parentOwnerStoreId: true },
    });
    if (!store) {
      reply.code(404).send({ error: 'Store not found' });
      return;
    }

    const scopeIds = scaleBarcodeConfigScopeIdsFromStore(store);
    if (!scopeIds) {
      reply.code(400).send({ error: 'Owner store not found for this location' });
      return;
    }

    const configs = await prisma.scaleBarcodeConfig.findMany({
      where: {
        storeId: { in: scopeIds },
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
      const cleanBarcode = normalizeBarcodeForLookup(barcode);
      
      // Get store to find ownerStoreId (same logic as parseScaleBarcode)
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, type: true, parentOwnerStoreId: true },
      });

      if (store) {
        const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
        
        if (ownerStoreId) {
          // Check if product exists by SKU with correct ownerStoreId
          let productBySku = await prisma.product.findFirst({
            where: {
              ownerStoreId,
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
                orderBy: { effectiveFrom: 'desc' },
                take: 1,
              },
            },
          });

          if (!productBySku) {
            productBySku = await fetchProductByWhitespaceNormalizedSkuPlu(
              ownerStoreId,
              storeId,
              barcode
            );
          }

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
              // Product exists and has price - return it as if parseScaleBarcode found it
              // This is a fallback in case parseScaleBarcode missed it
              const price = productBySku.storeProductPrices[0]?.pricePerUnit || 0;
              return {
                productId: productBySku.id,
                plu: productBySku.plu,
                qtyPcs: 1,
                pricePerKg: price,
                lineTotal: price,
                raw: barcode,
              };
            }
          }
        }
      }

      const storeForScope = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, type: true, parentOwnerStoreId: true },
      });
      const scopeIds = storeForScope ? scaleBarcodeConfigScopeIdsFromStore(storeForScope) : null;
      const allConfigs = scopeIds?.length
        ? await prisma.scaleBarcodeConfig.findMany({
            where: { storeId: { in: scopeIds }, isActive: true },
          })
        : [];

      const prefixMatch = allConfigs.filter(
        (c) => cleanBarcode.startsWith(c.prefix) || barcode.startsWith(c.prefix)
      );

      // Scale rules exist for this chain but this scan looks like a retail SKU (e.g. masale EAN)
      if (allConfigs.length > 0 && prefixMatch.length === 0) {
        reply.code(200).send(null);
        return;
      }

      if (prefixMatch.length > 0) {
        prefixMatch.sort((a, b) => b.prefix.length - a.prefix.length);
        const config = prefixMatch[0];
        reply.code(400).send({
          error: 'Failed to parse scale barcode',
          message: 'Barcode format does not match scale barcode configuration',
          barcode,
          configName: config.name,
          configPrefix: config.prefix,
        });
        return;
      }

      reply.code(200).send(null);
      return;
    }

    return result;
  });
}

