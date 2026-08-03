export const CONTENT_TEMPLATE_KINDS = [
  'proposal_html',
  'proposal_email',
  'contract_email',
  'email_reply',
] as const;

export type ContentTemplateKind = (typeof CONTENT_TEMPLATE_KINDS)[number];

export const ACCOUNT_TEMPLATE_KINDS = [
  'proposal_html',
  'proposal_email',
  'contract_email',
] as const;

export type AccountTemplateKind = (typeof ACCOUNT_TEMPLATE_KINDS)[number];

export const MAX_ACCOUNT_TEMPLATES_PER_KIND = 20;
export const MAX_USER_REPLY_PRESETS = 20;

export type SystemContentTemplate = {
  id: string;
  kind: ContentTemplateKind;
  name: string;
  slug: string;
  description: string | null;
  subject: string | null;
  bodyHtml: string;
  bodyText: string;
  signature: string | null;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
};

export type AccountContentTemplate = {
  id: string;
  accountId: string;
  kind: AccountTemplateKind;
  name: string;
  description: string | null;
  subject: string | null;
  bodyHtml: string;
  bodyText: string;
  signature: string | null;
  isDefault: boolean;
  sourceSystemTemplateId: string | null;
  updatedAt: string;
};

export type UserContentTemplate = {
  id: string;
  userId: string;
  kind: 'email_reply';
  name: string;
  bodyText: string;
  isDefault: boolean;
  sourceSystemTemplateId: string | null;
  updatedAt: string;
};

export type ResolvedTemplate = {
  source: 'account' | 'user' | 'system' | 'code';
  id: string | null;
  name: string;
  subject: string | null;
  bodyHtml: string;
  bodyText: string;
  signature: string | null;
};

export type PickerTemplate = {
  id: string;
  source: 'account' | 'user' | 'system';
  name: string;
  description: string | null;
  isDefault: boolean;
  kind: ContentTemplateKind;
  subject: string | null;
  bodyHtml: string;
  bodyText: string;
  signature: string | null;
};
