const path = require('path');
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
} catch (_) {}

/**
 * Loyalty portal must talk to the Fastify API.
 * Locally: rewrite /api → localhost API.
 * On Vercel: client usually calls NEXT_PUBLIC_API_URL directly; rewrites still
 * need a valid absolute URL at build time or `next build` fails.
 */
function resolveRewriteApiUrl() {
  const isDev = process.env.NODE_ENV === 'development';
  const raw =
    process.env.API_REWRITE_URL ||
    (isDev ? 'http://localhost:3003' : process.env.NEXT_PUBLIC_API_URL) ||
    '';

  const cleaned = String(raw).trim().replace(/\/+$/, '');

  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }

  // Dev default, or production fallback if env is missing/malformed
  return isDev ? 'http://localhost:3003' : 'https://k2-chicken-pos-api.vercel.app';
}

const rewriteApiUrl = resolveRewriteApiUrl();
console.log(`[loyalty-web] API rewrite → ${rewriteApiUrl}`);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${rewriteApiUrl}/api/:path*` }];
  },
};

module.exports = nextConfig;
