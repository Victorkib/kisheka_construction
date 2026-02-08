/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,

  // Image optimization for SEO
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: '**.googleapis.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Headers for SEO and security
  async headers() {
    return [
      // Never cache API responses
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          // SEO Headers
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Performance Headers
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          // Permissions Policy (formerly Feature Policy)
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // Static assets caching
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Redirects for SEO-friendly URLs
  async redirects() {
    return [
      // Example: Old URL to new URL redirects
      // {
      //   source: '/old-page',
      //   destination: '/new-page',
      //   permanent: true,
      // },
    ];
  },

  // Rewrites to maintain clean URLs
  async rewrites() {
    return {
      beforeFiles: [
        // API rewrites can go here
      ],
      afterFiles: [],
      fallback: [],
    };
  },

  // Compression for better SEO (Core Web Vitals)
  compress: true,

  // Disable ETag generation to prevent route handler caching
  // API routes with dynamic data should use 'force-dynamic' export instead
  // ETags can cause stale data issues in production
  generateEtags: false,

  // Production source maps for error tracking
  productionBrowserSourceMaps: false,

  // Experimental features for performance
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
