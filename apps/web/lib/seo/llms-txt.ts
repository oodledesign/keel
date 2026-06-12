import 'server-only';

import appConfig from '~/config/app.config';
import { getMarketingSiteOrigin } from '~/lib/app-host-routing';
import { APP_LANDING_SLUGS, APP_LANDING_PAGES } from '~/lib/marketing/app-landing-pages';
import { SEGMENT_LANDING_PAGES } from '~/lib/marketing/segment-landing-pages';

import { buildMarketingSitemap } from './marketing-sitemap';

function url(base: string, path: string) {
  return `${base}${path || '/'}`;
}

export async function buildLlmsTxt(): Promise<string> {
  const base = getMarketingSiteOrigin().replace(/\/$/, '');
  const sitemapEntries = await buildMarketingSitemap();

  const segmentLines = Object.values(SEGMENT_LANDING_PAGES).map(
    (segment) =>
      `- [${segment.hero.eyebrow}](${url(base, `/${segment.slug}`)}): ${segment.seo.description}`,
  );

  const appLines = APP_LANDING_SLUGS.map((slug) => {
    const app = APP_LANDING_PAGES[slug];
    return `- [${app.name}](${url(base, `/apps/${slug}`)}): ${app.seo.description}`;
  });

  const contentLines = sitemapEntries
    .filter(
      (item) =>
        item.url.includes('/blog/') ||
        item.url.includes('/docs/') ||
        item.url.includes('/changelog/'),
    )
    .slice(0, 40)
    .map((item) => `- ${item.url}`);

  return [
    `# ${appConfig.name}`,
    '',
    `> ${appConfig.description}`,
    '',
    'Keel is a Life CRM — personal life, work, property, and community workspaces in one account.',
    '',
    '## Primary pages',
    `- [Home](${url(base, '/')}): Main marketing homepage`,
    `- [Pricing](${url(base, '/pricing')}): Plans and add-ons`,
    `- [Apps](${url(base, '/apps')}): Keel app modules overview`,
    `- [Documentation](${url(base, '/docs')}): Product documentation`,
    `- [Blog](${url(base, '/blog')}): Articles and updates`,
    `- [Changelog](${url(base, '/changelog')}): Release notes`,
    `- [Contact](${url(base, '/contact')}): Get in touch`,
    '',
    '## Workspaces',
    ...segmentLines,
    '',
    '## Apps',
    ...appLines,
    '',
    '## Policies',
    `- [Privacy policy](${url(base, '/privacy-policy')})`,
    `- [Terms of service](${url(base, '/terms-of-service')})`,
    `- [Cookie policy](${url(base, '/cookie-policy')})`,
    '',
    ...(contentLines.length > 0
      ? ['## Published content', ...contentLines, '']
      : []),
    '## Optional',
    `- Full URL list: ${url(base, '/sitemap.xml')}`,
    `- App sign-in: ${process.env.NEXT_PUBLIC_APP_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? base}`,
  ].join('\n');
}
