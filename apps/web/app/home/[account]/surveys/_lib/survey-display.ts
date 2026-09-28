type SurveyClientSource = {
  recipient_name?: string | null;
  client?: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  deal?: { contact_name?: string | null } | null;
};

export function surveyClientName(proposal: SurveyClientSource): string | null {
  return (
    proposal.client?.display_name?.trim() ||
    [proposal.client?.first_name, proposal.client?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    proposal.recipient_name?.trim() ||
    proposal.deal?.contact_name?.trim() ||
    null
  );
}

export function surveyPath(
  template: string,
  accountSlug: string,
  proposalId: string,
  sectionKey?: string,
): string {
  const path = template
    .replace('[account]', accountSlug)
    .replace('[id]', proposalId);
  return sectionKey ? path.replace('[sectionKey]', sectionKey) : path;
}
