import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  Gauge,
  Globe2,
  LayoutDashboard,
  LayoutList,
  Network,
  ScanSearch,
  Search,
  Sparkles,
} from 'lucide-react';

import type { RanklyProjectPaths } from './rankly-project-paths';

export type RanklySectionId =
  | 'dashboard'
  | 'keywords'
  | 'siteExplorer'
  | 'siteCrawler'
  | 'pages'
  | 'pagespeed'
  | 'aiAudit'
  | 'briefs'
  | 'clusters';

export type RanklyProjectSection = {
  id: RanklySectionId;
  navLabel: string;
  icon: LucideIcon;
  pathKey: keyof RanklyProjectPaths;
  dashboardTitle?: string;
  dashboardBody?: string;
};

export const RANKLY_PROJECT_SECTIONS: RanklyProjectSection[] = [
  {
    id: 'dashboard',
    navLabel: 'Dashboard',
    icon: LayoutDashboard,
    pathKey: 'dashboard',
  },
  {
    id: 'keywords',
    navLabel: 'Keyword tracking',
    icon: Search,
    pathKey: 'keywords',
    dashboardTitle: 'Keyword tracking',
    dashboardBody: 'SERP positions, refresh schedule, and rank history.',
  },
  {
    id: 'siteExplorer',
    navLabel: 'Site Explorer',
    icon: Globe2,
    pathKey: 'siteExplorer',
    dashboardTitle: 'Site Explorer',
    dashboardBody: 'Authority, traffic, backlinks, and AI visibility metrics.',
  },
  {
    id: 'siteCrawler',
    navLabel: 'Site Crawler',
    icon: ScanSearch,
    pathKey: 'siteCrawler',
    dashboardTitle: 'Site Crawler',
    dashboardBody: 'Internal crawl for broken links, metadata issues, and duplicates.',
  },
  {
    id: 'pages',
    navLabel: 'Pages',
    icon: LayoutList,
    pathKey: 'pages',
    dashboardTitle: 'Pages',
    dashboardBody: 'Unified page scores and page-specific recommendations from crawl and PageSpeed data.',
  },
  {
    id: 'pagespeed',
    navLabel: 'PageSpeed',
    icon: Gauge,
    pathKey: 'pagespeed',
    dashboardTitle: 'PageSpeed Insights',
    dashboardBody: 'Lighthouse scores and Core Web Vitals for key URLs.',
  },
  {
    id: 'aiAudit',
    navLabel: 'AI Search Audit',
    icon: Sparkles,
    pathKey: 'aiAudit',
    dashboardTitle: 'AI Search Audit',
    dashboardBody: 'Entity, content, and technical readiness for AI citations.',
  },
  {
    id: 'briefs',
    navLabel: 'Content briefs',
    icon: FileText,
    pathKey: 'briefs',
    dashboardTitle: 'Content briefs',
    dashboardBody: 'Writer-ready SEO briefs from SERP analysis.',
  },
  {
    id: 'clusters',
    navLabel: 'Keyword clusters',
    icon: Network,
    pathKey: 'clusters',
    dashboardTitle: 'Keyword clusters',
    dashboardBody: 'Pillar + spoke architecture from seed keywords.',
  },
];

export const RANKLY_DASHBOARD_TOOL_SECTIONS = RANKLY_PROJECT_SECTIONS.filter(
  (section) => section.dashboardTitle != null,
);

export function getRanklySection(id: RanklySectionId): RanklyProjectSection {
  const section = RANKLY_PROJECT_SECTIONS.find((item) => item.id === id);
  if (!section) {
    throw new Error(`Unknown Rankly section: ${id}`);
  }
  return section;
}

export function isRanklySectionActive(
  sectionId: RanklySectionId,
  pathname: string,
  href: string,
): boolean {
  if (sectionId === 'dashboard') {
    return pathname === href;
  }
  return pathname.startsWith(href);
}
