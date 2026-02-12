/**
 * Metadata Configuration File
 * Central SEO configuration for the application
 *
 * This file contains:
 * - Site metadata
 * - SEO keywords
 * - Social media information
 * - Analytics configuration
 */

export const siteMetadata = {
  // Basic Site Info
  title: 'Doshaki Construction Accountability System',
  shortTitle: 'Doshaki',
  description:
    'Comprehensive construction project management system with real-time material tracking, expense management, labour tracking, and financial analytics.',
  author: 'Doshaki Construction',
  email: 'contact@doshaki.netlify.app',
  phone: '+1-234-567-8900',

  // URLs
  siteUrl: 'https://doshaki.netlify.app',
  baseUrl: 'https://doshaki.netlify.app',
  imageUrl: 'https://doshaki.netlify.app/og-image.png',

  // Location
  location: {
    country: 'US',
    region: 'Massachusetts',
    city: 'Boston',
  },

  // Primary Keywords
  keywords: [
    'construction management',
    'project management software',
    'material tracking system',
    'expense tracking',
    'labour management',
    'construction accountability',
    'budget tracking software',
    'supplier management',
    'construction software',
    'project accountability system',
  ],

  // Features for schema
  features: [
    {
      name: 'Material Tracking',
      description: 'Monitor materials from purchase to usage',
    },
    {
      name: 'Expense Management',
      description: 'Real-time expense and budget tracking',
    },
    {
      name: 'Labour Tracking',
      description: 'Efficient labour management and tracking',
    },
    {
      name: 'Financial Analytics',
      description: 'Comprehensive financial reporting and analytics',
    },
    {
      name: 'Approval Workflows',
      description: 'Multi-level approval processes with audit trails',
    },
    {
      name: 'Stock Management',
      description: 'Inventory and stock level management',
    },
  ],

  // Social Media
  socialMedia: {
    facebook: 'https://facebook.com/doshaki.construction',
    linkedin: 'https://linkedin.com/company/doshaki-construction',
    twitter: 'https://twitter.com/doshaki_construction',
    youtube: 'https://youtube.com/@doshaki-construction',
  },

  // Organization details for schema
  organization: {
    name: 'Doshaki Construction',
    type: 'Organization',
    url: 'https://doshaki.netlify.app',
    logo: 'https://doshaki.netlify.app/logo.png',
    description:
      'Professional construction project management and accountability system',
    contactPoint: {
      type: 'ContactPoint',
      contactType: 'Customer Service',
      email: 'contact@doshaki.netlify.app',
      phone: '+1-234-567-8900',
      areaServed: 'US',
      availableLanguage: 'en',
    },
  },

  // Analytics
  analytics: {
    google: {
      trackingId: process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || '',
      enabled: !!process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID,
    },
    hotjar: {
      siteId: process.env.NEXT_PUBLIC_HOTJAR_ID || '',
      enabled: !!process.env.NEXT_PUBLIC_HOTJAR_ID,
    },
  },

  // Search Console verification
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
    bing: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || '',
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || '',
  },

  // Open Graph defaults
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Doshaki Construction',
    image: {
      url: 'https://doshaki.netlify.app/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Doshaki Construction Accountability System',
    },
  },

  // Twitter Card defaults
  twitter: {
    card: 'summary_large_image',
    creator: '@kisheka_construction',
    site: '@kisheka_construction',
  },

  // Sitemap configuration
  sitemap: {
    maxUrls: 5000,
    changeFreq: 'weekly',
    priority: 0.7,
  },

  // Robots configuration
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

// Page-specific metadata templates
export const pageTemplates = {
  landing: {
    title: 'Construction Project Management Software | Doshaki',
    description:
      'Professional construction management system for material tracking, expense management, and project accountability. Start free today.',
    keywords: [
      'construction management',
      'project management',
      'material tracking',
      'accountability',
    ],
  },
  auth: {
    title: 'Login to Doshaki Construction System',
    description:
      'Sign in to manage your construction projects, materials, and finances.',
    robots: 'noindex, nofollow',
  },
  dashboard: {
    title: 'Dashboard',
    description: 'Your construction project management dashboard',
    robots: 'noindex, nofollow',
  },
};

export default siteMetadata;
