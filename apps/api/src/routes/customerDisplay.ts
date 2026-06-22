// @ts-nocheck
import { FastifyInstance, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { getUser } from '../utils/auth.js';

/**
 * Customer Display realtime plumbing.
 *
 * The cashier browser publishes live bill snapshots straight to Ably; the
 * customer-facing TV/tablet subscribes straight from Ably. Our API only mints
 * short-lived Ably token requests (and a long-lived display "session" JWT used
 * for pairing) — so no per-cart-change load hits Vercel/Neon.
 *
 * Nothing here touches billing, inventory, loyalty or payment workflows.
 */

const DISPLAY_TTL_MS = 60 * 60 * 1000; // Ably token valid 1h; SDK auto-renews via authUrl.
const SESSION_TTL = '30d'; // Paired display stays paired across power-cycles.

function channelForStore(storeId: string): string {
  return `store:${storeId}:display`;
}

/**
 * Build a signed Ably TokenRequest with the account API key, without pulling in
 * the full `ably` SDK on the serverless function. Mirrors Ably's documented
 * canonical signing (HMAC-SHA256 over the newline-joined request fields).
 */
function buildAblyTokenRequest(
  apiKey: string,
  capability: Record<string, string[]>,
  clientId: string
): Record<string, any> | null {
  const sep = apiKey.indexOf(':');
  if (sep <= 0) return null;
  const keyName = apiKey.slice(0, sep);
  const keySecret = apiKey.slice(sep + 1);

  // Canonical capability: sorted resource keys, sorted ops.
  const canonical: Record<string, string[]> = {};
  for (const resource of Object.keys(capability).sort()) {
    canonical[resource] = [...capability[resource]].sort();
  }
  const capabilityStr = JSON.stringify(canonical);

  const ttl = DISPLAY_TTL_MS;
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');

  const signText =
    [keyName, String(ttl), capabilityStr, clientId, String(timestamp), nonce].join(
      '\n'
    ) + '\n';
  const mac = crypto
    .createHmac('sha256', keySecret)
    .update(signText)
    .digest('base64');

  return {
    keyName,
    ttl,
    capability: capabilityStr,
    clientId,
    timestamp,
    nonce,
    mac,
  };
}

export async function customerDisplayRoutes(fastify: FastifyInstance) {
  /**
   * Cashier-only: mint a pairing session for the customer display.
   * Returns a long-lived signed token the TV stores so it survives refresh /
   * power-cycle. The cashier UI turns this into a QR / link to /customer-display.
   */
  fastify.get(
    '/pairing',
    { preHandler: [fastify.authenticate] },
    async (request: any, reply: FastifyReply) => {
      const storeId = getUser(request).storeId;
      const sessionToken = fastify.jwt.sign(
        { storeId, kind: 'cd-session' },
        { expiresIn: SESSION_TTL }
      );
      return {
        sessionToken,
        channel: channelForStore(storeId),
        realtimeEnabled: !!process.env.ABLY_API_KEY,
      };
    }
  );

  /**
   * Dual-mode Ably auth endpoint (used as the SDK `authUrl` by both sides):
   *  - Display device: passes `?t=<sessionToken>` -> subscribe-only token.
   *  - Cashier browser: passes Authorization Bearer JWT -> publish+subscribe token.
   * The Ably SDK calls this automatically and renews before expiry, so this is
   * hit roughly once per hour per device — not per cart change.
   */
  fastify.get('/token', async (request: any, reply: FastifyReply) => {
    const apiKey = process.env.ABLY_API_KEY;
    if (!apiKey) {
      reply.code(503).send({ error: 'Realtime not configured' });
      return;
    }

    const sessionToken = (request.query as any)?.t;
    let storeId: string | null = null;
    let capability: Record<string, string[]>;
    let clientId: string;

    if (sessionToken) {
      // Display device path.
      try {
        const payload: any = fastify.jwt.verify(String(sessionToken));
        if (payload?.kind !== 'cd-session' || !payload?.storeId) {
          reply.code(401).send({ error: 'Invalid display session' });
          return;
        }
        storeId = String(payload.storeId);
      } catch {
        reply.code(401).send({ error: 'Invalid or expired display session' });
        return;
      }
      capability = { [channelForStore(storeId)]: ['subscribe', 'presence'] };
      clientId = `display:${storeId}`;
    } else {
      // Cashier path — verify the normal app JWT.
      try {
        await request.jwtVerify();
        const payload = request.user as any;
        if (!payload?.storeId) {
          reply.code(401).send({ error: 'Unauthorized' });
          return;
        }
        storeId = String(payload.storeId);
      } catch {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }
      capability = {
        [channelForStore(storeId)]: ['publish', 'subscribe', 'presence'],
      };
      clientId = `cashier:${(request.user as any).userId || storeId}`;
    }

    const tokenRequest = buildAblyTokenRequest(apiKey, capability, clientId);
    if (!tokenRequest) {
      reply.code(500).send({ error: 'Realtime misconfigured' });
      return;
    }
    // Ably SDK expects the raw TokenRequest object back from authUrl.
    reply.send(tokenRequest);
  });
}
