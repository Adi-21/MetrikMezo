import type { NextConfig } from "next";

// Validate environment variables at build time
const requiredEnvVars = {
  'NEXT_PUBLIC_PRIVY_APP_ID': process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  'PRIVY_APP_SECRET': process.env.PRIVY_APP_SECRET,
};

console.log('🔍 Next.js Environment Variables Check:');
Object.entries(requiredEnvVars).forEach(([key, value]) => {
  if (value) {
    console.log(`✅ ${key}: ${key.includes('SECRET') ? 'configured' : value}`);
  } else {
    console.log(`❌ ${key}: missing`);
  }
});

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    // Ensure environment variables are available at runtime
    NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ijskdn.invalid-placeholder' },
    ].filter(Boolean) as any,
  },
};

export default nextConfig;
