/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@azela-pos/shared', '@azela-pos/offline'],
};

module.exports = nextConfig;

