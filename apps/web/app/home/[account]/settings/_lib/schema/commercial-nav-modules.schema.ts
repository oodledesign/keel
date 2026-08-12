import { z } from 'zod';

import { COMMERCIAL_PROPERTY_WORKSPACE_MODULE_ORDER } from '~/config/workspace-module-order';

export const COMMERCIAL_NAV_TOGGLE_KEYS = [
  'dashboard',
  'listings',
  'pipeline',
  'clients',
  'requirements',
  'viewings',
  'proposals',
  'leases',
  'reports',
  'tasks',
  'notes',
  'team',
] as const satisfies ReadonlyArray<
  (typeof COMMERCIAL_PROPERTY_WORKSPACE_MODULE_ORDER)[number]
>;

export type CommercialNavToggleKey =
  (typeof COMMERCIAL_NAV_TOGGLE_KEYS)[number];

export const COMMERCIAL_NAV_TOGGLE_LABELS: Record<
  CommercialNavToggleKey,
  string
> = {
  dashboard: 'Dashboard',
  listings: 'Disposals',
  pipeline: 'WIP',
  clients: 'Contacts',
  requirements: 'Requirements',
  viewings: 'Viewings',
  proposals: 'HoTs / Proposals',
  leases: 'Sales & lettings',
  reports: 'Insights',
  tasks: 'Tasks',
  notes: 'Notes and files',
  team: 'Team',
};

export const saveCommercialNavModulesSchema = z.object({
  accountId: z.string().uuid(),
  modules: z.record(z.enum(COMMERCIAL_NAV_TOGGLE_KEYS), z.boolean()),
});
