// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from '@azela-pos/shared';

export interface AuthUser {
  userId: string;
  storeId: string;
  role: UserRole;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: FastifyReply) => Promise<void>;
  }
  
  interface FastifyRequest {
    user?: AuthUser;
  }
}

