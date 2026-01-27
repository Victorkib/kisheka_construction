/**
 * RSS Feed Generator API Route
 * Provides RSS feed for construction industry blogs/news
 * Route: /api/feed.xml
 */

export async function GET() {
  const baseUrl = 'https://doshaki.netlify.app';

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Kisheka Construction Accountability System</title>
    <link>${baseUrl}</link>
    <description>Construction project management platform for material tracking, expense management, and labour accountability</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <image>
      <url>${baseUrl}/logo.png</url>
      <title>Kisheka Construction</title>
      <link>${baseUrl}</link>
    </image>
    <item>
      <title>Kisheka Construction - Your Accountability Partner</title>
      <link>${baseUrl}</link>
      <guid>${baseUrl}/</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <description>Professional construction project management system with comprehensive material tracking, expense management, labour tracking, and financial analytics.</description>
      <content:encoded><![CDATA[
        <p>Kisheka Construction Accountability System streamlines your construction operations with:</p>
        <ul>
          <li>Real-time material tracking and inventory management</li>
          <li>Comprehensive expense and budget tracking</li>
          <li>Labour management and efficiency tracking</li>
          <li>Supplier communication and coordination</li>
          <li>Financial analytics and reporting</li>
        </ul>
      ]]></content:encoded>
    </item>
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
