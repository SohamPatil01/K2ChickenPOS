const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@azela-pos/shared'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

module.exports = nextConfig;

