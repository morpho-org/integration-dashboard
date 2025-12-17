/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Set the output file tracing root to this directory
  outputFileTracingRoot: __dirname,

  // Empty turbopack config to silence Next.js 16 warning
  // (webpack config is still used for production builds with --webpack flag)
  turbopack: {},

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
    };

    return config;
  },
};

module.exports = nextConfig;
