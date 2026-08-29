import 'server-only';

import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import type { WorkspaceProfile } from '../workspace-profile';
import type { WorkspaceSpaceType } from './account-modules';
import type { TeamAccountWorkspace } from './team-account-workspace.loader';
import { spaceTypeFromProfile } from './workspace-profile';

/** Full business CRM (invoices, brain, services, content templates). */
export const WORK_DESIGN_SETTINGS_PROFILES: WorkspaceProfile[] = [
  'work_design',
];

/** Finances module settings (work + landlord property, not commercial agency). */
export const FINANCES_SETTINGS_PROFILES: WorkspaceProfile[] = [
  'work_design',
  'work_property',
];

/** Knowledge base / brain indexing (business CRM + group workspaces). */
export const KNOWLEDGE_SETTINGS_PROFILES: WorkspaceProfile[] = [
  'work_design',
  'family',
  'community',
];

/** Work + landlord property + commercial agency share clients, notes, docs, etc. */
export const BUSINESS_WORKSPACE_SPACE_TYPES: WorkspaceSpaceType[] = [
  'work',
  'property',
  'commercial-property',
  'building-surveyor',
];

export const BUILDING_SURVEYOR_WORKSPACE_SPACE_TYPES: WorkspaceSpaceType[] = [
  'building-surveyor',
];

export const COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES: WorkspaceSpaceType[] = [
  'commercial-property',
];

/** Public form generator (pipeline, mailing list, listing enquiries). */
export const FORMS_WORKSPACE_SPACE_TYPES: WorkspaceSpaceType[] = [
  'work',
  'commercial-property',
];

/**
 * Paid / granted Apps (Signatures, Rankly, Feedflow, Videos, Generate, Apps hub).
 * Commercial Property agencies can keep Business Lite add-ons after conversion.
 */
export const ADDON_APPS_SPACE_TYPES: WorkspaceSpaceType[] = [
  'work',
  'commercial-property',
];

export const GROUP_WORKSPACE_SPACE_TYPES: WorkspaceSpaceType[] = [
  'family',
  'community',
];

/** Accounts that use the shared `notes` / `docs` tables. */
export const ACCOUNT_NOTES_SPACE_TYPES: WorkspaceSpaceType[] = [
  ...BUSINESS_WORKSPACE_SPACE_TYPES,
  ...GROUP_WORKSPACE_SPACE_TYPES,
];

export function redirectIfSpaceNotIn(
  workspace: TeamAccountWorkspace,
  accountSlug: string,
  allowed: WorkspaceSpaceType[],
) {
  const kind = spaceTypeFromProfile(workspace.workspaceProfile);
  if (!allowed.includes(kind)) {
    redirect(pathsConfig.app.accountHome.replace('[account]', accountSlug));
  }
}

export function redirectIfProfileNotIn(
  workspace: TeamAccountWorkspace,
  accountSlug: string,
  allowed: WorkspaceProfile[],
) {
  if (!allowed.includes(workspace.workspaceProfile)) {
    redirect(pathsConfig.app.accountSettings.replace('[account]', accountSlug));
  }
}
