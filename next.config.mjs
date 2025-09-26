/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { 
    serverActions: { bodySizeLimit: '2mb' } 
  },
  webpack: (config, { isServer }) => {
    // Disable webpack worker support for server-side rendering
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
  // Disable static optimization for pages that use dynamic imports
  trailingSlash: false,
};
export default nextConfig;
