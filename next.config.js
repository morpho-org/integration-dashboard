/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Set the output file tracing root to this directory
  outputFileTracingRoot: __dirname,

  // Handle API proxy (previously in package.json "proxy" field)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://api.morpho.org/:path*',
      },
    ];
  },

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
