import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true,
  },
  basePath: '/solana.orb-oracle.stabulity.nexus',
  // Disable font optimization for better consistency
  optimizeFonts: false,
  // Prevent build hanging issues
  experimental: {
    esmExternals: false,
  },
}

export default nextConfig
