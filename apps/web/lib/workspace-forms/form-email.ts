/**
 * Per-form email automation stored on workspace_forms.email_settings jsonb.
 * Safe to import from client and server (no Node APIs). Server parse uses the
 * regex sanitizer fallback for admin-authored template HTML.
 */
import { sanitizeCommunityHtml } from '~/lib/sanitize-community-html';

import type { WorkspaceFormField } from './form-fields';
import { formatFormFileValue, parseFormFileValue } from './form-file';

export const WORKSPACE_FORM_EMAIL_KINDS = [
  'autoresponder',
  'notification',
] as const;

export type WorkspaceFormEmailKind =
  (typeof WORKSPACE_FORM_EMAIL_KINDS)[number];

export type WorkspaceFormEmailTemplate = {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
};

export type WorkspaceFormEmailRule = {
  id: string;
  kind: WorkspaceFormEmailKind;
  enabled: boolean;
  /** When null, the rule always matches (else / default). */
  fieldKey: string | null;
  equals: string | null;
  templateId: string;
  sortOrder: number;
};

export type WorkspaceFormEmailSettings = {
  templates: WorkspaceFormEmailTemplate[];
  rules: WorkspaceFormEmailRule[];
  notifyMemberIds: string[];
  notifyEmails: string[];
  /**
   * Team-notification emails append a label/value block of every submitted
   * answer unless the template already uses {{answers}}.
   */
  includeSubmittedAnswers: boolean;
};

export const DEFAULT_WORKSPACE_FORM_EMAIL_SETTINGS: WorkspaceFormEmailSettings =
  {
    templates: [],
    rules: [],
    notifyMemberIds: [],
    notifyEmails: [],
    includeSubmittedAnswers: true,
  };

export const MAX_FORM_NOTIFY_EMAILS = 10;

/** Same check used when persisting extra team-notification addresses. */
export const FORM_NOTIFY_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CommitFormNotifyEmailsResult = {
  emails: string[];
  added: string[];
  invalid: string[];
  duplicates: string[];
  overflow: string[];
};

export function normalizeFormNotifyEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidFormNotifyEmail(value: string): boolean {
  const email = normalizeFormNotifyEmail(value);
  return (
    email.length > 0 &&
    email.length <= 160 &&
    FORM_NOTIFY_EMAIL_PATTERN.test(email)
  );
}

/** Split a typed or pasted draft on commas, semicolons, and newlines. */
export function splitFormNotifyEmailDraft(raw: string): string[] {
  return raw
    .split(/[,;\n\r]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Commit one or more draft addresses onto the existing notify list.
 * Invalid tokens are returned so the input can keep them for correction.
 */
export function commitFormNotifyEmails(
  current: string[],
  draft: string,
): CommitFormNotifyEmailsResult {
  const tokens = splitFormNotifyEmailDraft(draft);
  const emails = [
    ...new Set(
      current.map(normalizeFormNotifyEmail).filter(isValidFormNotifyEmail),
    ),
  ];
  const seen = new Set(emails);
  const added: string[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];
  const overflow: string[] = [];

  for (const token of tokens) {
    const email = normalizeFormNotifyEmail(token);
    if (!isValidFormNotifyEmail(email)) {
      invalid.push(token.trim());
      continue;
    }
    if (seen.has(email)) {
      duplicates.push(email);
      continue;
    }
    if (emails.length >= MAX_FORM_NOTIFY_EMAILS) {
      overflow.push(email);
      continue;
    }
    seen.add(email);
    emails.push(email);
    added.push(email);
  }

  return { emails, added, invalid, duplicates, overflow };
}

export const FORM_EMAIL_ANSWERS_TOKEN_KEYS = [
  'answers',
  'submitted_answers',
] as const;

export type FormNotifyMemberOption = {
  userId: string;
  name: string;
  email: string;
};

export type FormEmailMergeToken = {
  token: string;
  label: string;
  group: 'builtin' | 'field';
};

export type FormSubmittedAnswer = {
  key: string;
  label: string;
  value: string;
  href?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function escapeFormEmailHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function parseWorkspaceFormEmailSettings(
  raw: unknown,
): WorkspaceFormEmailSettings {
  const row = asRecord(raw);
  if (!row) return { ...DEFAULT_WORKSPACE_FORM_EMAIL_SETTINGS };

  const templates: WorkspaceFormEmailTemplate[] = [];
  if (Array.isArray(row.templates)) {
    for (const item of row.templates) {
      const rec = asRecord(item);
      if (!rec) continue;
      const id = readString(rec.id, 80);
      const name = readString(rec.name, 80);
      const subject = readString(rec.subject, 180);
      const bodyHtml = sanitizeCommunityHtml(
        typeof rec.bodyHtml === 'string' ? rec.bodyHtml : '',
      );
      if (!id || !name || !subject) continue;
      templates.push({ id, name, subject, bodyHtml });
    }
  }

  const rules: WorkspaceFormEmailRule[] = [];
  if (Array.isArray(row.rules)) {
    for (const [index, item] of row.rules.entries()) {
      const rec = asRecord(item);
      if (!rec) continue;
      const id = readString(rec.id, 80);
      const kind = rec.kind;
      const templateId = readString(rec.templateId, 80);
      if (
        !id ||
        (kind !== 'autoresponder' && kind !== 'notification') ||
        !templateId
      ) {
        continue;
      }
      rules.push({
        id,
        kind,
        enabled: rec.enabled !== false,
        fieldKey: readString(rec.fieldKey, 60) || null,
        equals: readString(rec.equals, 80) || null,
        templateId,
        sortOrder:
          typeof rec.sortOrder === 'number' && Number.isFinite(rec.sortOrder)
            ? rec.sortOrder
            : index,
      });
    }
  }

  const notifyMemberIds = Array.isArray(row.notifyMemberIds)
    ? row.notifyMemberIds
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
        .slice(0, 40)
    : [];

  const notifyEmails = Array.isArray(row.notifyEmails)
    ? commitFormNotifyEmails(
        [],
        row.notifyEmails
          .filter((email): email is string => typeof email === 'string')
          .join('\n'),
      ).emails
    : [];

  return {
    templates,
    rules,
    notifyMemberIds,
    notifyEmails,
    includeSubmittedAnswers: row.includeSubmittedAnswers !== false,
  };
}

export function serializeWorkspaceFormEmailSettings(
  settings: WorkspaceFormEmailSettings,
): WorkspaceFormEmailSettings {
  return parseWorkspaceFormEmailSettings(settings);
}

function normalizeEquals(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim().toLowerCase();
  return '';
}

export function matchFormEmailTemplate(
  settings: WorkspaceFormEmailSettings,
  values: Record<string, unknown>,
  kind: WorkspaceFormEmailKind,
): WorkspaceFormEmailTemplate | null {
  const rules = settings.rules
    .filter((rule) => rule.kind === kind && rule.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  for (const rule of rules) {
    const matches =
      !rule.fieldKey || rule.equals == null || rule.equals === ''
        ? true
        : normalizeEquals(values[rule.fieldKey]) ===
          normalizeEquals(rule.equals);

    if (!matches) continue;

    return (
      settings.templates.find((template) => template.id === rule.templateId) ??
      null
    );
  }

  return null;
}

export function interpolateFormEmailText(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => {
    return vars[key.toLowerCase()] ?? '';
  });
}

const FORM_EMAIL_RAW_HTML_KEYS = new Set<string>(FORM_EMAIL_ANSWERS_TOKEN_KEYS);

export function interpolateFormEmailHtml(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => {
    const normalized = key.toLowerCase();
    const value = vars[normalized] ?? '';
    if (FORM_EMAIL_RAW_HTML_KEYS.has(normalized)) return value;
    return escapeFormEmailHtml(value).replace(/\n/g, '<br />');
  });
}

export function formEmailHasAnswersToken(template: string): boolean {
  return /\{\{\s*(answers|submitted_answers)\s*\}\}/i.test(template);
}

export function formatFormFieldValue(raw: unknown): string {
  const file = parseFormFileValue(raw);
  if (file) return formatFormFileValue(file);
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .map((item) => formatFormFieldValue(item))
      .filter(Boolean)
      .join(', ');
  }
  if (raw == null) return '';
  if (typeof raw === 'object') return '';
  return String(raw);
}

export function listFormSubmittedAnswers(input: {
  fields: WorkspaceFormField[];
  values: Record<string, unknown>;
}): FormSubmittedAnswer[] {
  return input.fields
    .filter((field) => field.type !== 'hidden')
    .map((field) => {
      const raw = input.values[field.key] ?? input.values[field.id];
      const file = parseFormFileValue(raw);
      return {
        key: field.key,
        label: field.label,
        value: formatFormFieldValue(raw),
        ...(file?.url ? { href: file.url } : {}),
      };
    });
}

export function renderFormAnswersText(answers: FormSubmittedAnswer[]): string {
  return answers
    .map((answer) => `${answer.label}: ${answer.value || '—'}`)
    .join('\n');
}

export function renderFormAnswersHtml(
  answers: FormSubmittedAnswer[],
  submissionUrl?: string | null,
): string {
  const rows = answers
    .map((answer) => {
      const display = answer.href
        ? `<a href="${escapeFormEmailHtml(answer.href)}">${escapeFormEmailHtml(answer.value.split(' (')[0] || answer.value)}</a>`
        : escapeFormEmailHtml(answer.value).replace(/\n/g, '<br />');
      return `<tr><td style="padding:6px 16px 6px 0;vertical-align:top;font-weight:600;color:#09111F;">${escapeFormEmailHtml(answer.label)}</td><td style="padding:6px 0;vertical-align:top;color:#09111F;">${display || '—'}</td></tr>`;
    })
    .join('');

  const link =
    submissionUrl?.trim() && /^https?:\/\//i.test(submissionUrl.trim())
      ? `<p style="margin:16px 0 0;"><a href="${escapeFormEmailHtml(submissionUrl.trim())}">Open submissions in Ozer</a></p>`
      : '';

  return `<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;"><p style="margin:0 0 10px;font-weight:600;color:#09111F;">Submitted answers</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">${rows}</table>${link}</div>`;
}

function assignFieldVar(
  vars: Record<string, string>,
  key: string,
  text: string,
) {
  const normalized = key.toLowerCase();
  vars[normalized] = text;
  const prefixed = `field_${normalized}`;
  if (!(prefixed in vars)) {
    vars[prefixed] = text;
  }
}

export function buildFormEmailVars(input: {
  formName: string;
  accountName: string;
  eventAddress: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  contactName: string;
  contactEmail: string;
  fields: WorkspaceFormField[];
  values: Record<string, unknown>;
  submissionUrl?: string | null;
}): Record<string, string> {
  const answers = listFormSubmittedAnswers(input);
  const answersText = renderFormAnswersText(answers);
  const submissionUrl = input.submissionUrl?.trim() || '';

  const vars: Record<string, string> = {
    form_name: input.formName,
    form_title: input.formName,
    event_name: input.formName,
    account_name: input.accountName,
    event_address: input.eventAddress?.trim() || '',
    event_date: input.eventDate?.trim() || '',
    event_time: input.eventTime?.trim() || '',
    name: input.contactName,
    email: input.contactEmail,
    submitter_name: input.contactName,
    submitter_email: input.contactEmail,
    submission_url: submissionUrl,
    submission_link: submissionUrl,
    answers: answersText,
    submitted_answers: answersText,
  };

  for (const field of input.fields) {
    const text = formatFormFieldValue(
      input.values[field.key] ?? input.values[field.id],
    );
    assignFieldVar(vars, field.key, text);
  }

  return vars;
}

export function withFormEmailHtmlVars(
  vars: Record<string, string>,
  answersHtml: string,
): Record<string, string> {
  return {
    ...vars,
    answers: answersHtml,
    submitted_answers: answersHtml,
  };
}

export function composeFormNotificationBody(input: {
  bodyHtml: string;
  vars: Record<string, string>;
  includeSubmittedAnswers: boolean;
  answersHtml: string;
}): string {
  const htmlVars = withFormEmailHtmlVars(input.vars, input.answersHtml);
  const inner = interpolateFormEmailHtml(input.bodyHtml || '', htmlVars);
  if (
    !input.includeSubmittedAnswers ||
    !input.answersHtml ||
    formEmailHasAnswersToken(input.bodyHtml)
  ) {
    return inner;
  }
  return `${inner}${input.answersHtml}`;
}

export function listFormEmailMergeTokens(
  fields: WorkspaceFormField[],
): FormEmailMergeToken[] {
  const builtins: FormEmailMergeToken[] = [
    { token: '{{name}}', label: 'Submitter name', group: 'builtin' },
    { token: '{{email}}', label: 'Submitter email', group: 'builtin' },
    { token: '{{form_name}}', label: 'Form title', group: 'builtin' },
    { token: '{{account_name}}', label: 'Workspace', group: 'builtin' },
    { token: '{{event_name}}', label: 'Event name', group: 'builtin' },
    { token: '{{event_address}}', label: 'Event address', group: 'builtin' },
    { token: '{{event_date}}', label: 'Event date', group: 'builtin' },
    { token: '{{event_time}}', label: 'Event time', group: 'builtin' },
    {
      token: '{{submission_url}}',
      label: 'Submissions link',
      group: 'builtin',
    },
    { token: '{{answers}}', label: 'All answers', group: 'builtin' },
  ];

  const seen = new Set(builtins.map((item) => item.token));
  const fieldTokens: FormEmailMergeToken[] = [];

  for (const field of fields) {
    if (field.type === 'hidden') continue;
    const token = `{{${field.key}}}`;
    if (seen.has(token)) continue;
    seen.add(token);
    fieldTokens.push({
      token,
      label: field.label,
      group: 'field',
    });
  }

  return [...builtins, ...fieldTokens];
}

export function insertFormEmailMergeToken(html: string, token: string): string {
  const trimmed = html.trim();
  if (!trimmed) return `<p>${token}</p>`;
  if (/<\/p>\s*$/i.test(trimmed)) {
    return trimmed.replace(/<\/p>\s*$/i, ` ${token}</p>`);
  }
  return `${trimmed}<p>${token}</p>`;
}

export function createEmptyFormEmailTemplate(
  existing: WorkspaceFormEmailTemplate[],
  kind: WorkspaceFormEmailKind = 'autoresponder',
): WorkspaceFormEmailTemplate {
  const index = existing.length + 1;
  if (kind === 'notification') {
    return {
      id: newId('tpl'),
      name: `Team notification ${index}`,
      subject: 'New {{form_name}} response from {{name}}',
      bodyHtml:
        '<p><strong>{{name}}</strong> ({{email}}) submitted <strong>{{form_name}}</strong>.</p>',
    };
  }
  return {
    id: newId('tpl'),
    name: `Template ${index}`,
    subject: 'Thanks for your response',
    bodyHtml: '<p>Thanks — we received your response.</p>',
  };
}

export function createEmptyFormEmailRule(
  kind: WorkspaceFormEmailKind,
  existing: WorkspaceFormEmailRule[],
  templateId: string,
): WorkspaceFormEmailRule {
  const sameKind = existing.filter((rule) => rule.kind === kind);
  return {
    id: newId('rule'),
    kind,
    enabled: true,
    fieldKey: null,
    equals: null,
    templateId,
    sortOrder: sameKind.length,
  };
}

export function defaultRsvpEmailSettings(): WorkspaceFormEmailSettings {
  const yes: WorkspaceFormEmailTemplate = {
    id: 'rsvp_yes',
    name: 'RSVP — Yes',
    subject: 'Thanks for your RSVP — looking forward to seeing you',
    bodyHtml: [
      '<p>Hi {{name}},</p>',
      '<p>Thanks for your RSVP — we are looking forward to seeing you at <strong>{{event_name}}</strong>.</p>',
      '<p>{{event_address}}</p>',
      '<p>You can reply to this email if your plans change.</p>',
    ].join(''),
  };

  const no: WorkspaceFormEmailTemplate = {
    id: 'rsvp_no',
    name: 'RSVP — No',
    subject: "Sorry you can't make it",
    bodyHtml: [
      '<p>Hi {{name}},</p>',
      "<p>Sorry you can't make it to <strong>{{event_name}}</strong> — you can update your RSVP if plans change.</p>",
      '<p>{{event_address}}</p>',
    ].join(''),
  };

  const notify: WorkspaceFormEmailTemplate = {
    id: 'rsvp_notify',
    name: 'RSVP — Host notification',
    subject: 'New RSVP from {{name}}: {{attendance}}',
    bodyHtml:
      '<p><strong>{{name}}</strong> ({{email}}) responded to {{event_name}}.</p>',
  };

  return {
    templates: [yes, no, notify],
    rules: [
      {
        id: 'rsvp_auto_yes',
        kind: 'autoresponder',
        enabled: true,
        fieldKey: 'attendance',
        equals: 'Yes',
        templateId: yes.id,
        sortOrder: 0,
      },
      {
        id: 'rsvp_auto_no',
        kind: 'autoresponder',
        enabled: true,
        fieldKey: 'attendance',
        equals: 'No',
        templateId: no.id,
        sortOrder: 1,
      },
      {
        id: 'rsvp_host_notify',
        kind: 'notification',
        enabled: true,
        fieldKey: null,
        equals: null,
        templateId: notify.id,
        sortOrder: 0,
      },
    ],
    notifyMemberIds: [],
    notifyEmails: [],
    includeSubmittedAnswers: true,
  };
}
