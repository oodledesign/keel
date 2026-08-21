import type { WorkspaceSpaceType } from '~/home/[account]/_lib/server/account-modules';

/** Work (agency) and commercial-property workspaces may use SOPs. */
export const SOP_WORKSPACE_SPACE_TYPES: WorkspaceSpaceType[] = [
  'work',
  'commercial-property',
];
