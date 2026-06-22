import pathsConfig from '~/config/paths.config';
import { navHrefPathname } from '~/lib/dashboard-shortcuts/personal-home-url';

/** Serializable icon keys for mobile bottom nav (resolved client-side). */
export type MobileNavIconKey =
  | 'home'
  | 'tasks'
  | 'pipeline'
  | 'email'
  | 'planner'
  | 'today'
  | 'people'
  | 'jobs'
  | 'schedule'
  | 'clients'
  | 'meetings'
  | 'websites'
  | 'support'
  | 'invoices'
  | 'proposals'
  | 'contracts'
  | 'notes'
  | 'brain'
  | 'sops'
  | 'messages'
  | 'finances'
  | 'videos'
  | 'rankly'
  | 'signatures'
  | 'feedflow'
  | 'reviews'
  | 'social'
  | 'apps'
  | 'properties'
  | 'calendar'
  | 'shopping'
  | 'meal'
  | 'workspace';

const PERSONAL_SEGMENT_KEYS: Record<string, MobileNavIconKey> = {
  tasks: 'tasks',
  pipeline: 'pipeline',
  email: 'email',
  planner: 'planner',
  people: 'people',
  settings: 'people',
};

const WORKSPACE_SEGMENT_KEYS: Record<string, MobileNavIconKey> = {
  jobs: 'jobs',
  tasks: 'tasks',
  planner: 'planner',
  schedule: 'schedule',
  pipeline: 'pipeline',
  clients: 'clients',
  meetings: 'meetings',
  websites: 'websites',
  support: 'support',
  invoices: 'invoices',
  proposals: 'proposals',
  contracts: 'contracts',
  people: 'people',
  notes: 'notes',
  brain: 'brain',
  sops: 'sops',
  messages: 'messages',
  finances: 'finances',
  videos: 'videos',
  rankly: 'rankly',
  signatures: 'signatures',
  feedflow: 'feedflow',
  reviews: 'reviews',
  social: 'social',
  apps: 'apps',
  properties: 'properties',
  calendar: 'calendar',
  shopping: 'shopping',
  meal: 'meal',
};

function normalizeNavPath(path: string): string {
  return navHrefPathname(path);
}

export function resolveNavIconKey(path: string): MobileNavIconKey {
  const normalized = normalizeNavPath(path);
  const parts = normalized.split('/').filter(Boolean);

  if (parts[0] !== 'app') {
    return 'home';
  }

  if (parts.length === 1 || (parts.length === 2 && parts[1] === 'home')) {
    return 'home';
  }

  if (normalized === normalizeNavPath(pathsConfig.app.personalPlannerDay)) {
    return 'today';
  }

  if (normalized === normalizeNavPath(pathsConfig.app.personalPlanner)) {
    return 'planner';
  }

  if (
    parts.length >= 4 &&
    parts[2] === 'planner' &&
    parts[3] === 'day'
  ) {
    return 'today';
  }

  if (
    parts.length >= 4 &&
    parts[2] === 'planner' &&
    parts[3] === 'plan'
  ) {
    return 'planner';
  }

  if (normalized === normalizeNavPath(pathsConfig.app.personalEmailAssistant)) {
    return 'email';
  }

  if (parts.length === 2) {
    const personal = PERSONAL_SEGMENT_KEYS[parts[1]!];
    if (personal) return personal;
    // `/app/{workspaceSlug}` dashboard
    return 'workspace';
  }

  if (parts.length >= 3) {
    const moduleKey = parts[2]!.split('?')[0]!;
    const workspace = WORKSPACE_SEGMENT_KEYS[moduleKey];
    if (workspace) return workspace;
  }

  return 'home';
}
