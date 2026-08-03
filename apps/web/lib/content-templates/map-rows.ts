import type {
  AccountContentTemplate,
  ContentTemplateKind,
  SystemContentTemplate,
  UserContentTemplate,
} from './types';

export function mapSystemTemplate(
  row: Record<string, unknown>,
): SystemContentTemplate {
  return {
    id: String(row.id),
    kind: row.kind as ContentTemplateKind,
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    description: (row.description as string | null) ?? null,
    subject: (row.subject as string | null) ?? null,
    bodyHtml: String(row.body_html ?? ''),
    bodyText: String(row.body_text ?? ''),
    signature: (row.signature as string | null) ?? null,
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 0),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function mapAccountTemplate(
  row: Record<string, unknown>,
): AccountContentTemplate {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    kind: row.kind as AccountContentTemplate['kind'],
    name: String(row.name ?? ''),
    description: (row.description as string | null) ?? null,
    subject: (row.subject as string | null) ?? null,
    bodyHtml: String(row.body_html ?? ''),
    bodyText: String(row.body_text ?? ''),
    signature: (row.signature as string | null) ?? null,
    isDefault: Boolean(row.is_default),
    sourceSystemTemplateId:
      (row.source_system_template_id as string | null) ?? null,
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function mapUserTemplate(
  row: Record<string, unknown>,
): UserContentTemplate {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    kind: 'email_reply',
    name: String(row.name ?? ''),
    bodyText: String(row.body_text ?? ''),
    isDefault: Boolean(row.is_default),
    sourceSystemTemplateId:
      (row.source_system_template_id as string | null) ?? null,
    updatedAt: String(row.updated_at ?? ''),
  };
}
