import pathsConfig from '~/config/paths.config';

import {
  SHORTCUT_CATALOG_RANKLY_PROJECT,
  SHORTCUT_CATALOG_ROUTE,
} from './catalog-ids';
import type { ShortcutCatalogItem } from './types';

function accountPath(template: string, accountSlug: string) {
  return template.replace('[account]', accountSlug);
}

/** Legacy module-key → path template (for shortcuts saved before route-based catalog). */
const LEGACY_WORKSPACE_MODULE_PATHS: Record<string, string> = {
  projects: pathsConfig.app.accountJobs,
  tasks: pathsConfig.app.accountTasks,
  schedule: pathsConfig.app.accountSchedule,
  pipeline: pathsConfig.app.accountPipeline,
  clients: pathsConfig.app.accountClients,
  websites: pathsConfig.app.accountWebsites,
  support_tickets: pathsConfig.app.accountSupport,
  invoices: pathsConfig.app.accountInvoices,
  proposals: pathsConfig.app.accountProposals,
  contracts: pathsConfig.app.accountContracts,
  team: pathsConfig.app.accountMembers,
  notes: pathsConfig.app.accountNotes,
  finances: pathsConfig.app.accountFinances,
  videos: pathsConfig.app.accountVideos,
  properties: pathsConfig.app.accountProperties,
  tenants: pathsConfig.app.accountClients,
  maintenance: pathsConfig.app.accountJobs,
  calendar: pathsConfig.app.accountFamilyCalendar,
  shopping: pathsConfig.app.accountShopping,
  meal_plan: pathsConfig.app.accountMealPlan,
  community_schedule: pathsConfig.app.accountCommunitySchedule,
  community_tasks: pathsConfig.app.accountCommunityTasks,
  community_notes: pathsConfig.app.accountCommunityNotes,
  rankly: pathsConfig.app.accountRanklyDashboard,
  signatures: pathsConfig.app.accountSignaturesDashboard,
  reviews: pathsConfig.app.accountFeedflowReviews,
  social: pathsConfig.app.accountFeedflowSocialAccounts,
};

const LEGACY_PERSONAL_PATHS: Record<string, string> = {
  'personal.home': pathsConfig.app.home,
  'personal.planner': pathsConfig.app.personalPlanner,
  'personal.people': pathsConfig.app.personalPeople,
  'personal.tasks': `${pathsConfig.app.home}/tasks`,
  'personal.pipeline': `${pathsConfig.app.home}/pipeline`,
};

export function resolveShortcutHref(
  catalogId: string,
  params: Record<string, string>,
): string | null {
  if (catalogId === SHORTCUT_CATALOG_ROUTE) {
    const href = params.href?.trim();
    return href && href.startsWith('/') ? href : null;
  }

  if (catalogId === SHORTCUT_CATALOG_RANKLY_PROJECT) {
    const slug = params.accountSlug;
    const projectId = params.projectId;
    if (!slug || !projectId) return null;
    return accountPath(pathsConfig.app.accountRanklyProjectDetail, slug).replace(
      '[projectId]',
      projectId,
    );
  }

  // Legacy personal catalog ids
  const legacyPersonal = LEGACY_PERSONAL_PATHS[catalogId];
  if (legacyPersonal) return legacyPersonal;

  // Legacy workspace.module
  if (catalogId === 'workspace.module') {
    const slug = params.accountSlug;
    const module = params.module;
    if (!slug || !module) return null;
    const template = LEGACY_WORKSPACE_MODULE_PATHS[module];
    if (!template) return null;
    return accountPath(template, slug);
  }

  if (catalogId === 'workspace.dashboard') {
    const slug = params.accountSlug;
    if (!slug) return null;
    return accountPath(pathsConfig.app.accountHome, slug);
  }

  return null;
}

export function catalogItemHref(item: ShortcutCatalogItem): string | null {
  return resolveShortcutHref(item.catalogId, item.params);
}

export function flattenNavItems(
  items: Array<{
    label: string;
    path?: string;
    description?: string;
    children?: Array<{ label: string; path: string; description?: string }>;
  }>,
): Array<{ label: string; path: string; description?: string }> {
  const out: Array<{ label: string; path: string; description?: string }> = [];
  for (const item of items) {
    if (item.path) {
      out.push({
        label: item.label,
        path: item.path,
        description: item.description,
      });
    }
    if (item.children) {
      for (const child of item.children) {
        out.push(child);
      }
    }
  }
  return out;
}

export function routeCatalogItem(input: {
  label: string;
  href: string;
  category: string;
  description?: string;
  keywords?: string[];
}): ShortcutCatalogItem | null {
  const href = input.href.trim();
  if (!href.startsWith('/')) return null;

  return {
    catalogId: SHORTCUT_CATALOG_ROUTE,
    label: input.label,
    description: input.description,
    category: input.category,
    params: { href },
    keywords: [input.label, input.category, href, ...(input.keywords ?? [])],
  };
}
