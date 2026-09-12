/**
 * Welcome-automation matching for `trigger_type = new_subscriber`.
 *
 * An automation with both `formId` and `audienceListId` null is workspace-wide.
 * A scoped automation matches when its form and/or list equals the signup
 * context (OR). If a global automation and a scoped one both match, both send.
 */

export type CampaignAutomationScope = {
  formId: string | null;
  audienceListId: string | null;
};

export type NewSubscriberAutomationContext = {
  formId?: string | null;
  audienceListId?: string | null;
  /**
   * When false, skip workspace-wide automations. Used for a later form signup
   * after the workspace mailing preference already existed.
   */
  includeUnscoped?: boolean;
};

export function isUnscopedWelcomeAutomation(
  automation: CampaignAutomationScope,
): boolean {
  return !automation.formId && !automation.audienceListId;
}

export function automationMatchesNewSubscriberScope(
  automation: CampaignAutomationScope,
  context: NewSubscriberAutomationContext,
): boolean {
  if (isUnscopedWelcomeAutomation(automation)) {
    return context.includeUnscoped !== false;
  }

  if (automation.formId && context.formId === automation.formId) {
    return true;
  }

  if (
    automation.audienceListId &&
    context.audienceListId === automation.audienceListId
  ) {
    return true;
  }

  return false;
}

export function describeWelcomeAutomationScope(input: {
  formId: string | null;
  audienceListId: string | null;
  formName?: string | null;
  listName?: string | null;
}): string {
  if (!input.formId && !input.audienceListId) {
    return 'Any mailing list (workspace)';
  }

  const parts: string[] = [];
  if (input.formId) {
    parts.push(`Form: ${input.formName?.trim() || 'Selected form'}`);
  }
  if (input.audienceListId) {
    parts.push(`List: ${input.listName?.trim() || 'Selected list'}`);
  }
  return parts.join(' · ');
}
