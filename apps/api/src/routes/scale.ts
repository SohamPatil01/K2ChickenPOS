import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { scaleBarcodeConfigSchema, parseBarcodeSchema } from '@azela-pos/shared';
import { parseScaleBarcode } from '../utils/barcode.js';

export async function scaleRoutes(fastify: FastifyInstance) {

  fastify.get('/config', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const storeId = request.user!.storeId;

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
      const data = scaleBarcodeConfigSchema.parse(request.body);
      const storeId = request.user!.storeId;

      const config = await prisma.scaleBarcodeConfig.create({
        data: {
          storeId,
          ...data,
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

  fastify.put('/config/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const { id } = request.params;
    const data = scaleBarcodeConfigSchema.parse(request.body);
    const storeId = request.user!.storeId;

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

  fastify.delete('/config/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const storeId = request.user!.storeId;

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
    const { barcode, configId } = parseBarcodeSchema.parse(request.body);
    const storeId = request.user!.storeId;

    const result = await parseScaleBarcode(barcode, storeId, configId);

    if (!result) {
      reply.code(400).send({ error: 'Failed to parse barcode' });
      return;
    }

    return result;
  });
}

