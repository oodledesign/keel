import type { WebsitePlanningTab } from '~/lib/websites/planning-types';

/**
 * Tabs that require `addon_site_studio`. Core Websites keeps overview, sitemap,
 * wireframes, and content docs available without the add-on.
 */
export const SITE_STUDIO_GATED_TABS: readonly WebsitePlanningTab[] = [
  'brief',
  'design',
  'seo',
  'site',
  'export',
  'build',
] as const;

export function isSiteStudioGatedTab(tab: WebsitePlanningTab): boolean {
  return (SITE_STUDIO_GATED_TABS as readonly string[]).includes(tab);
}
