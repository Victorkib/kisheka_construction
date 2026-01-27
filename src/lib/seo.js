/**
 * SEO Utilities Library
 * Provides helper functions and constants for SEO optimization
 *
 * Usage:
 * import { generatePageMetadata, SITE_CONFIG } from '@/lib/seo';
 *
 * export const metadata = generatePageMetadata({
 *   title: 'Page Title',
 *   description: 'Page description',
 *   path: '/page-path',
 * });
 */

export const SITE_CONFIG = {
  name: 'Doshaki Construction',
  title: 'Doshaki Construction Accountability System',
  description:
    'Comprehensive construction project management system with real-time material tracking, expense management, labour tracking, and financial analytics.',
  baseUrl: 'https://doshaki.netlify.app',
  socialImage: 'https://doshaki.netlify.app/og-image.png',
  author: 'Doshaki Construction',
  locale: 'en_US',
  email: 'contact@doshaki.netlify.app',
};

/**
 * Generate metadata for pages
 * @param {Object} config - Page configuration
 * @param {string} config.title - Page title
 * @param {string} config.description - Page description
 * @param {string} config.path - Page path (e.g., '/projects')
 * @param {string} [config.image] - OG image URL
 * @param {string} [config.type] - OG type (default: 'website')
 * @param {Array} [config.keywords] - Page keywords
 * @returns {Object} Next.js metadata object
 */
export function generatePageMetadata({
  title,
  description,
  path = '/',
  image = SITE_CONFIG.socialImage,
  type = 'website',
  keywords = [],
}) {
  const fullTitle = `${title} | ${SITE_CONFIG.name}`;
  const url = `${SITE_CONFIG.baseUrl}${path}`;

  return {
    title: fullTitle,
    description,
    keywords: [
      'construction management',
      'project tracking',
      'material procurement',
      ...keywords,
    ],
    authors: [{ name: SITE_CONFIG.author }],
    creator: SITE_CONFIG.author,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_CONFIG.name,
      type,
      locale: SITE_CONFIG.locale,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
      creator: '@kisheka_construction',
    },
    alternates: {
      canonical: url,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

/**
 * Generate JSON-LD structured data
 * @param {string} type - Schema type (e.g., 'Organization', 'WebPage')
 * @param {Object} data - Schema data
 * @returns {string} JSON-LD script content
 */
export function generateJsonLd(type, data) {
  const baseData = {
    '@context': 'https://schema.org',
    '@type': type,
  };

  return JSON.stringify({ ...baseData, ...data });
}

/**
 * Organization schema for website
 */
export const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_CONFIG.name,
  url: SITE_CONFIG.baseUrl,
  logo: `${SITE_CONFIG.baseUrl}/logo.png`,
  description: SITE_CONFIG.description,
  email: SITE_CONFIG.email,
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'Customer Service',
    email: SITE_CONFIG.email,
  },
  sameAs: [
    'https://www.facebook.com/kisheka.construction',
    'https://www.linkedin.com/company/kisheka-construction',
    'https://twitter.com/kisheka_construction',
  ],
};

/**
 * Software Application schema
 */
export const SOFTWARE_APP_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_CONFIG.title,
  description: SITE_CONFIG.description,
  url: SITE_CONFIG.baseUrl,
  applicationCategory: 'BusinessApplication',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '150',
  },
  author: {
    '@type': 'Organization',
    name: SITE_CONFIG.name,
  },
  isAccessibleForFree: true,
};

/**
 * BreadcrumbList schema
 * @param {Array} items - Breadcrumb items [{name: 'Home', url: '/'}, ...]
 */
export function generateBreadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_CONFIG.baseUrl}${item.url}`,
    })),
  };
}

/**
 * FAQ schema
 * @param {Array} faqs - FAQ items [{question: 'Q?', answer: 'A'}]
 */
export function generateFaqSchema(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate canonical URL
 * @param {string} path - Page path
 * @returns {string} Full canonical URL
 */
export function getCanonicalUrl(path = '/') {
  return `${SITE_CONFIG.baseUrl}${path}`;
}

/**
 * SEO Meta Tags to include in HTML head
 */
export const SEO_META_TAGS = [
  {
    name: 'viewport',
    content: 'width=device-width, initial-scale=1, maximum-scale=5',
  },
  {
    name: 'theme-color',
    content: '#2563eb',
  },
  {
    name: 'apple-mobile-web-app-capable',
    content: 'yes',
  },
  {
    name: 'apple-mobile-web-app-status-bar-style',
    content: 'black-translucent',
  },
  {
    name: 'format-detection',
    content: 'telephone=no',
  },
];

/**
 * Check if page should be indexed
 * @param {string} path - Page path
 * @returns {boolean} True if page should be indexed
 */
export function shouldIndexPage(path) {
  // Don't index protected routes
  const noIndexPaths = [
    '/dashboard',
    '/projects',
    '/api',
    '/admin',
    '/profile',
    '/auth',
  ];

  return !noIndexPaths.some((p) => path.startsWith(p));
}

/**
 * Generate robots meta content
 * @param {string} path - Page path
 * @returns {string} Robots meta content
 */
export function getRobotsMeta(path) {
  if (!shouldIndexPage(path)) {
    return 'noindex, nofollow';
  }
  return 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
}
