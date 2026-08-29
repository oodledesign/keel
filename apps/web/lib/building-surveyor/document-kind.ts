import pathsConfig from '~/config/paths.config';

export type ProposalDocumentKind = 'proposal' | 'survey_report';

export type ProposalDocumentCopy = {
  kind: ProposalDocumentKind;
  singular: string;
  plural: string;
  pageTitle: string;
  pageDescription: string;
  createLabel: string;
  createSheetTitle: string;
  aiGenerateLabel: string;
  aiDialogTitle: string;
  generateButton: string;
  emptyList: string;
  accessDenied: string;
  untitled: string;
  defaultTitle: string;
  searchPlaceholder: string;
  dealLabel: string;
  dealPlaceholder: string;
  contentLabel: string;
  editorPlaceholder: string;
  savedToast: string;
  sendLabel: string;
  backLabel: string;
  referencedContext: string;
  privateNotePlaceholder: string;
  emailTemplatesHint: string;
  referenceLabel: string;
  templateKind: 'proposal_html' | 'survey_report_html';
  templatePickerTitle: string;
  replaceConfirm: string;
  draftApplied: string;
};

const PROPOSAL_COPY: ProposalDocumentCopy = {
  kind: 'proposal',
  singular: 'proposal',
  plural: 'proposals',
  pageTitle: 'Proposals',
  pageDescription: 'Create and send proposals for client approval',
  createLabel: 'Create proposal',
  createSheetTitle: 'Create proposal',
  aiGenerateLabel: 'AI generate',
  aiDialogTitle: 'Generate proposal with AI',
  generateButton: 'Generate proposal',
  emptyList: 'No proposals in this tab.',
  accessDenied: "You don't have access to proposals in this account.",
  untitled: 'Untitled proposal',
  defaultTitle: 'Proposal',
  searchPlaceholder: 'Search title or recipient...',
  dealLabel: 'Lead',
  dealPlaceholder: 'Select lead',
  contentLabel: 'Proposal content',
  editorPlaceholder: 'Write your proposal…',
  savedToast: 'Proposal saved',
  sendLabel: 'Send proposal',
  backLabel: 'Back to proposals',
  referencedContext: 'Context used when building this proposal.',
  privateNotePlaceholder: 'Internal notes about this proposal',
  emailTemplatesHint: 'Used when sending this proposal.',
  referenceLabel: 'Reference proposal (optional)',
  templateKind: 'proposal_html',
  templatePickerTitle: 'Apply proposal template',
  replaceConfirm: 'Replace the current proposal content with a new AI draft?',
  draftApplied: 'AI draft applied — review and save',
};

const SURVEY_COPY: ProposalDocumentCopy = {
  kind: 'survey_report',
  singular: 'survey',
  plural: 'surveys',
  pageTitle: 'Surveys',
  pageDescription:
    'Building survey reports with standard UK / RICS Home Survey headings',
  createLabel: 'Create survey',
  createSheetTitle: 'Create survey',
  aiGenerateLabel: 'Draft from transcript',
  aiDialogTitle: 'Draft survey from site notes',
  generateButton: 'Generate draft',
  emptyList: 'No surveys in this tab.',
  accessDenied: "You don't have access to surveys in this account.",
  untitled: 'Untitled survey',
  defaultTitle: 'Building survey',
  searchPlaceholder: 'Search title or client...',
  dealLabel: 'Enquiry',
  dealPlaceholder: 'Select enquiry',
  contentLabel: 'Survey report',
  editorPlaceholder: 'Write the survey report…',
  savedToast: 'Survey saved',
  sendLabel: 'Send report',
  backLabel: 'Back to surveys',
  referencedContext: 'Context used when drafting this survey.',
  privateNotePlaceholder: 'Internal notes about this survey',
  emailTemplatesHint: 'Used when sending this report.',
  referenceLabel: 'Reference survey (optional)',
  templateKind: 'survey_report_html',
  templatePickerTitle: 'Apply survey template',
  replaceConfirm: 'Replace the current survey content with a new draft?',
  draftApplied: 'Draft applied — review and save',
};

export function documentKindCopy(
  kind: ProposalDocumentKind = 'proposal',
): ProposalDocumentCopy {
  return kind === 'survey_report' ? SURVEY_COPY : PROPOSAL_COPY;
}

export function documentEditPath(
  accountSlug: string,
  documentId: string,
  kind: ProposalDocumentKind,
): string {
  const template =
    kind === 'survey_report'
      ? pathsConfig.app.accountSurveyEdit
      : pathsConfig.app.accountProposalEdit;
  return template
    .replace('[account]', accountSlug)
    .replace('[id]', documentId);
}

export function documentListPath(
  accountSlug: string,
  kind: ProposalDocumentKind,
): string {
  const template =
    kind === 'survey_report'
      ? pathsConfig.app.accountSurveys
      : pathsConfig.app.accountProposals;
  return template.replace('[account]', accountSlug);
}

export function titleForRecipient(
  kind: ProposalDocumentKind,
  recipientName: string,
): string {
  return kind === 'survey_report'
    ? `Survey for ${recipientName}`
    : `Proposal for ${recipientName}`;
}
