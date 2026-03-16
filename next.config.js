/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,

  // Enable Turbopack (Next.js 16 default)
  // Empty config to silence Next.js 16 warning
  turbopack: {},

  // Set the output file tracing root to this directory
  outputFileTracingRoot: __dirname,

  // Webpack configuration for compatibility
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };

    // Silence pino-pretty warning from WalletConnect
    config.resolve.alias = {
      ...config.resolve.alias,
      'pino-pretty': false,
      // blue-sdk-viem v4.5+ restricts subpath exports; alias the augment path
      '@morpho-org/blue-sdk-viem/lib/augment': path.resolve(
        __dirname,
        'node_modules/@morpho-org/blue-sdk-viem/lib/esm/augment/index.js'
      ),
    };

    return config;
  },
};

module.exports = nextConfig;
