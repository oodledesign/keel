/**
 * Per-form email automation stored on workspace_forms.email_settings jsonb.
 * Client-safe — no Node / server imports.
 */
import { sanitizeCommunityHtml } from '~/lib/sanitize-community-html';

import type { WorkspaceFormField } from './form-fields';

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
};

export const DEFAULT_WORKSPACE_FORM_EMAIL_SETTINGS: WorkspaceFormEmailSettings =
  {
    templates: [],
    rules: [],
    notifyMemberIds: [],
    notifyEmails: [],
  };

export const MAX_FORM_NOTIFY_EMAILS = 10;

export type FormNotifyMemberOption = {
  userId: string;
  name: string;
  email: string;
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
    ? [
        ...new Set(
          row.notifyEmails
            .filter((email): email is string => typeof email === 'string')
            .map((email) => email.trim().toLowerCase())
            .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
        ),
      ].slice(0, MAX_FORM_NOTIFY_EMAILS)
    : [];

  return { templates, rules, notifyMemberIds, notifyEmails };
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

export function buildFormEmailVars(input: {
  formName: string;
  accountName: string;
  eventAddress: string | null;
  contactName: string;
  contactEmail: string;
  fields: WorkspaceFormField[];
  values: Record<string, unknown>;
}): Record<string, string> {
  const vars: Record<string, string> = {
    form_name: input.formName,
    event_name: input.formName,
    account_name: input.accountName,
    event_address: input.eventAddress?.trim() || '',
    name: input.contactName,
    email: input.contactEmail,
  };

  for (const field of input.fields) {
    const raw = input.values[field.key] ?? input.values[field.id];
    const text =
      typeof raw === 'boolean'
        ? raw
          ? 'Yes'
          : 'No'
        : typeof raw === 'string'
          ? raw.trim()
          : raw == null
            ? ''
            : String(raw);
    vars[field.key.toLowerCase()] = text;
  }

  return vars;
}

export function createEmptyFormEmailTemplate(
  existing: WorkspaceFormEmailTemplate[],
): WorkspaceFormEmailTemplate {
  const index = existing.length + 1;
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
    bodyHtml: [
      '<p><strong>{{name}}</strong> ({{email}}) responded to {{event_name}}.</p>',
      '<p>Attendance: <strong>{{attendance}}</strong></p>',
    ].join(''),
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
  };
}
