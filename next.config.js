/** @type {import('next').NextConfig} */
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
    };

    return config;
  },
};

module.exports = nextConfig;
