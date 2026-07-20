import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@kit/site-blocks-core', '@kit/site-blocks-workspaces'],
};

export default nextConfig;
