/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent webpack from resolving symlinks to real paths.
  // Without this, node_modules → node_modules.nosync breaks module resolution.
  webpack: (config) => {
    config.resolve.symlinks = false;
    return config;
  },
};

module.exports = nextConfig;
