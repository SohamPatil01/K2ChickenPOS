const path = require('path');
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
} catch (_) {}

/**
 * Loyalty portal must talk to the Fastify API.
 * Root .env often has API_PORT / NEXT_PUBLIC_API_URL aimed at an old POS port (3001).
 * Prefer an explicit override, else default local API to 3003 (current monorepo default).
 */
const rewriteApiUrl =
  process.env.API_REWRITE_URL ||
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:3003'
    : process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:3003';

console.log(`[loyalty-web] API rewrite → ${rewriteApiUrl}`);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${rewriteApiUrl}/api/:path*` }];
  },
};

module.exports = nextConfig;
