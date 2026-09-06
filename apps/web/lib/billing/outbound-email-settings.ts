export const OUTBOUND_EMAIL_FEATURES = [
  'invoices',
  'proposals',
  'contracts',
  'portal_invites',
  'other',
] as const;

export type OutboundEmailFeature = (typeof OUTBOUND_EMAIL_FEATURES)[number];

export type OutboundEmailSettings = Record<OutboundEmailFeature, boolean>;

export const DEFAULT_OUTBOUND_EMAIL_SETTINGS: OutboundEmailSettings = {
  invoices: false,
  proposals: false,
  contracts: false,
  portal_invites: false,
  other: false,
};

export const OUTBOUND_EMAIL_FEATURE_LABELS: Record<
  OutboundEmailFeature,
  { label: string; description: string }
> = {
  invoices: {
    label: 'Invoices',
    description: 'Issued and paid invoice emails to clients',
  },
  proposals: {
    label: 'Proposals & quotes',
    description: 'Proposal and quote emails to clients',
  },
  contracts: {
    label: 'Contracts',
    description: 'Contract emails to clients',
  },
  portal_invites: {
    label: 'Client portal invites',
    description: 'Invites to the client portal',
  },
  other: {
    label: 'Other client email',
    description: 'Booking confirmations, project guest invites, and similar',
  },
};

export function parseOutboundEmailSettings(
  value: unknown,
): OutboundEmailSettings {
  const row =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    invoices: row.invoices === true,
    proposals: row.proposals === true,
    contracts: row.contracts === true,
    portal_invites: row.portal_invites === true,
    other: row.other === true,
  };
}

export function isOutboundFeatureEnabled(
  settings: OutboundEmailSettings,
  feature: OutboundEmailFeature,
): boolean {
  return settings[feature] === true;
}

export function shouldUseCustomSendingDomain(input: {
  allowedByPlan: boolean;
  featureEnabled: boolean;
  domainVerified: boolean;
}): boolean {
  return input.allowedByPlan && input.featureEnabled && input.domainVerified;
}
