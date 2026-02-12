/**
 * Robots.txt Dynamic Route Handler
 * Serves dynamic robots.txt based on environment
 * Route: /robots.txt
 */

export async function GET() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://doshaki.netlify.app';

  const robots = `# Robots.txt for Doshaki Construction Accountability System
# Last updated: ${new Date().toISOString()}

# Default rules for all bots
User-agent: *

# Allow crawling of public pages
Allow: /
Allow: /auth/login
Allow: /auth/register
Allow: /api/sitemap
Allow: /api/feed

# Disallow private/protected areas
Disallow: /api/
Disallow: /dashboard
Disallow: /projects
Disallow: /material-requests
Disallow: /purchase-orders
Disallow: /expenses
Disallow: /labour
Disallow: /suppliers
Disallow: /analytics
Disallow: /reports
Disallow: /profile
Disallow: /investors
Disallow: /equipment
Disallow: /.next/
Disallow: /admin/

# Disallow specific crawl patterns
Disallow: /*?*sort=
Disallow: /*?*filter=
Disallow: /auth/

# Sitemap location
Sitemap: ${baseUrl}/api/sitemap

# Crawl delay for responsible crawling
Crawl-delay: 1
Request-rate: 1/1s

# Google-specific optimizations
User-agent: Googlebot
Allow: /

# Bing-specific optimizations
User-agent: Bingbot
Allow: /

# Exclude bad bots
User-agent: MJ12bot
Disallow: /

User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /
`;

  return new Response(robots, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
    },
  });
}
