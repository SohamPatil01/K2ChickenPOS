const path = require('path');
// Load root .env so NEXT_PUBLIC_* (e.g. NEXT_PUBLIC_HQ_CONSOLE_URL) work when defined at repo root
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@azela-pos/shared', '@azela-pos/offline'],
  // Proxy API to same origin to avoid cross-origin requests and CORS preflight
  async rewrites() {
    return [
      // Browsers probe /favicon.ico even when metadata points at SVG
      { source: '/favicon.ico', destination: '/favicon.svg' },
      { source: '/favicon.png', destination: '/favicon.svg' },
      { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
    ];
  },
  // ESM in @azela-pos/shared uses ./foo.js specifiers; sources are .ts — map for webpack
  webpack: (config, { isServer }) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;

