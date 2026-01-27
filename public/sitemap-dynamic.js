/**
 * Dynamic Sitemap Generator
 * Generates sitemap for public pages only
 * Run: node public/sitemap-dynamic.js
 *
 * This script can be used in build process to generate dynamic sitemaps
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://doshaki.netlify.app';

const publicPages = [
  { url: '/', priority: '1.0', changefreq: 'weekly' },
  { url: '/auth/login', priority: '0.9', changefreq: 'monthly' },
  { url: '/auth/register', priority: '0.9', changefreq: 'monthly' },
];

function generateSitemap() {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicPages
  .map(
    (page) => `  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap);
  console.log('Sitemap generated successfully!');
}

generateSitemap();
