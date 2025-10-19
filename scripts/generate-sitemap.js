/*
 Simple sitemap generator used at build time.
 Usage: SITE_URL=https://example.com npm run generate-sitemap
 If SITE_URL is missing, it will warn and leave public/sitemap.xml untouched.
*/
import fs from 'fs';
import path from 'path';

const siteUrl = process.env.SITE_URL || process.env.SITEHOST || '';
const outPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');

if (!siteUrl) {
  console.warn('[sitemap] SITE_URL not set – leaving existing sitemap.xml as-is.');
  process.exit(0);
}

const urls = [
  {
    loc: siteUrl.replace(/\/$/, '') + '/',
    changefreq: 'daily',
    priority: '1.0',
  },
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
  .map(
    (u) => `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  )
  .join('\n')}\n</urlset>\n`;

fs.writeFileSync(outPath, xml, 'utf8');
console.log(`[sitemap] Wrote sitemap to ${outPath} with SITE_URL=${siteUrl}`);
