import {
  isCampaignsModuleEnabled,
  isWorkModuleEnabled,
} from '~/home/[account]/_lib/server/account-modules';

import type { WorkspaceFormDestination } from './form-fields';
import type { WorkspaceFormField } from './form-fields';
import type { WorkspaceFormTemplate } from './form-templates';

/**
 * Forms capability derived from workspace modules:
 * - `full` — Forms module on (complete builder)
 * - `audience` — Campaigns on, Forms off (subscribe / mailing-list lite)
 * - `none` — neither
 */
export type WorkspaceFormsMode = 'none' | 'audience' | 'full';

export function resolveWorkspaceFormsMode(
  moduleSettings: Record<string, boolean> | null | undefined,
): WorkspaceFormsMode {
  if (isWorkModuleEnabled(moduleSettings, 'forms')) {
    return 'full';
  }

  if (isCampaignsModuleEnabled(moduleSettings)) {
    return 'audience';
  }

  return 'none';
}

export function canAccessWorkspaceForms(
  moduleSettings: Record<string, boolean> | null | undefined,
): boolean {
  return resolveWorkspaceFormsMode(moduleSettings) !== 'none';
}

export function isFullWorkspaceForms(
  moduleSettings: Record<string, boolean> | null | undefined,
): boolean {
  return resolveWorkspaceFormsMode(moduleSettings) === 'full';
}

export const AUDIENCE_FORM_DESTINATIONS = ['mailing_list'] as const;

export const AUDIENCE_FORM_TEMPLATES = ['subscribe'] as const;

export function isAudienceFormDestination(
  destination: WorkspaceFormDestination,
): boolean {
  return destination === 'mailing_list';
}

export function isAudienceFormTemplate(
  template: WorkspaceFormTemplate,
): boolean {
  return template === 'subscribe';
}

export function audienceFormCreateError(input: {
  destination: WorkspaceFormDestination;
  template?: WorkspaceFormTemplate;
}): string | null {
  if (!isAudienceFormDestination(input.destination)) {
    return 'This workspace can only create subscribe / mailing-list forms.';
  }

  if (input.template && !isAudienceFormTemplate(input.template)) {
    return 'This workspace can only create subscribe / mailing-list forms.';
  }

  return null;
}

export function sanitizeAudienceFormFields(
  fields: WorkspaceFormField[],
): WorkspaceFormField[] {
  return fields.map((field) => {
    const next: WorkspaceFormField = { ...field };
    delete next.visibleWhen;
    delete next.jumpRules;

    if (next.type === 'file') {
      next.type = 'text';
    }

    return next;
  });
}
