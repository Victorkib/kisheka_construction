/**
 * Dynamic Sitemap Generator API Route
 * Generates sitemap.xml dynamically from pages
 * Route: /api/sitemap.xml
 */

export async function GET() {
  const baseUrl = 'https://doshaki.netlify.app';

  const staticPages = [
    {
      url: '/',
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'weekly',
      priority: 1.0,
    },
    {
      url: '/auth/login',
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'monthly',
      priority: 0.9,
    },
    {
      url: '/auth/register',
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'monthly',
      priority: 0.9,
    },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     ${staticPages
       .map(
         (page) => `
       <url>
         <loc>${baseUrl}${page.url}</loc>
         <lastmod>${page.lastmod}</lastmod>
         <changefreq>${page.changefreq}</changefreq>
         <priority>${page.priority}</priority>
       </url>
     `,
       )
       .join('')}
   </urlset>
 `;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
