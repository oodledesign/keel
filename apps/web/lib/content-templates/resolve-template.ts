import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  DEFAULT_INVOICE_EMAIL_BODY,
  DEFAULT_INVOICE_EMAIL_SIGNATURE,
  DEFAULT_INVOICE_EMAIL_SUBJECT,
} from '~/home/[account]/invoices/_lib/invoice-smart-fields';
import {
  DEFAULT_CONTRACT_EMAIL_BODY,
  DEFAULT_CONTRACT_EMAIL_SIGNATURE,
  DEFAULT_CONTRACT_EMAIL_SUBJECT,
  DEFAULT_PROPOSAL_EMAIL_BODY,
  DEFAULT_PROPOSAL_EMAIL_SIGNATURE,
  DEFAULT_PROPOSAL_EMAIL_SUBJECT,
} from '~/home/[account]/proposals/_lib/doc-smart-fields';
import { buildingSurveyBlankHtml } from '~/lib/building-surveyor/report-sections';

import {
  mapAccountTemplate,
  mapSystemTemplate,
  mapUserTemplate,
} from './map-rows';
import type {
  AccountTemplateKind,
  ContentTemplateKind,
  PickerTemplate,
  ResolvedTemplate,
} from './types';

function codeFallback(kind: ContentTemplateKind): ResolvedTemplate | null {
  if (kind === 'proposal_email') {
    return {
      source: 'code',
      id: null,
      name: 'Default proposal email',
      subject: DEFAULT_PROPOSAL_EMAIL_SUBJECT,
      bodyHtml: '',
      bodyText: DEFAULT_PROPOSAL_EMAIL_BODY,
      signature: DEFAULT_PROPOSAL_EMAIL_SIGNATURE,
    };
  }
  if (kind === 'contract_email') {
    return {
      source: 'code',
      id: null,
      name: 'Default contract email',
      subject: DEFAULT_CONTRACT_EMAIL_SUBJECT,
      bodyHtml: '',
      bodyText: DEFAULT_CONTRACT_EMAIL_BODY,
      signature: DEFAULT_CONTRACT_EMAIL_SIGNATURE,
    };
  }
  if (kind === 'invoice_email') {
    return {
      source: 'code',
      id: null,
      name: 'Default invoice email',
      subject: DEFAULT_INVOICE_EMAIL_SUBJECT,
      bodyHtml: '',
      bodyText: DEFAULT_INVOICE_EMAIL_BODY,
      signature: DEFAULT_INVOICE_EMAIL_SIGNATURE,
    };
  }
  if (kind === 'proposal_html') {
    return {
      source: 'code',
      id: null,
      name: 'Blank proposal',
      subject: null,
      bodyHtml: '',
      bodyText: '',
      signature: null,
    };
  }
  if (kind === 'survey_report_html') {
    return {
      source: 'code',
      id: null,
      name: 'RICS Home Survey headings',
      subject: null,
      bodyHtml: buildingSurveyBlankHtml(),
      bodyText: '',
      signature: null,
    };
  }
  return null;
}

/**
 * Resolve the default template for a kind.
 * Account default → active system (lowest sort_order) → code constants.
 */
export async function resolveDefaultTemplate(
  client: SupabaseClient,
  input: {
    kind: ContentTemplateKind;
    accountId?: string | null;
    userId?: string | null;
  },
): Promise<ResolvedTemplate | null> {
  if (
    input.accountId &&
    (input.kind === 'proposal_html' ||
      input.kind === 'proposal_email' ||
      input.kind === 'contract_email' ||
      input.kind === 'invoice_email' ||
      input.kind === 'survey_report_html')
  ) {
    const { data } = await client
      .from('account_content_templates')
      .select('*')
      .eq('account_id', input.accountId)
      .eq('kind', input.kind)
      .eq('is_default', true)
      .maybeSingle();

    if (data) {
      const mapped = mapAccountTemplate(data as Record<string, unknown>);
      return {
        source: 'account',
        id: mapped.id,
        name: mapped.name,
        subject: mapped.subject,
        bodyHtml: mapped.bodyHtml,
        bodyText: mapped.bodyText,
        signature: mapped.signature,
      };
    }
  }

  if (input.userId && input.kind === 'email_reply') {
    const { data } = await client
      .from('user_content_templates')
      .select('*')
      .eq('user_id', input.userId)
      .eq('kind', 'email_reply')
      .eq('is_default', true)
      .maybeSingle();

    if (data) {
      const mapped = mapUserTemplate(data as Record<string, unknown>);
      return {
        source: 'user',
        id: mapped.id,
        name: mapped.name,
        subject: null,
        bodyHtml: '',
        bodyText: mapped.bodyText,
        signature: null,
      };
    }
  }

  const { data: system } = await client
    .from('content_templates')
    .select('*')
    .eq('kind', input.kind)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (system) {
    const mapped = mapSystemTemplate(system as Record<string, unknown>);
    return {
      source: 'system',
      id: mapped.id,
      name: mapped.name,
      subject: mapped.subject,
      bodyHtml: mapped.bodyHtml,
      bodyText: mapped.bodyText,
      signature: mapped.signature,
    };
  }

  return codeFallback(input.kind);
}

export async function getTemplateById(
  client: SupabaseClient,
  input: {
    source: 'system' | 'account' | 'user';
    id: string;
  },
): Promise<ResolvedTemplate | null> {
  if (input.source === 'system') {
    const { data } = await client
      .from('content_templates')
      .select('*')
      .eq('id', input.id)
      .maybeSingle();
    if (!data) return null;
    const mapped = mapSystemTemplate(data as Record<string, unknown>);
    return {
      source: 'system',
      id: mapped.id,
      name: mapped.name,
      subject: mapped.subject,
      bodyHtml: mapped.bodyHtml,
      bodyText: mapped.bodyText,
      signature: mapped.signature,
    };
  }

  if (input.source === 'account') {
    const { data } = await client
      .from('account_content_templates')
      .select('*')
      .eq('id', input.id)
      .maybeSingle();
    if (!data) return null;
    const mapped = mapAccountTemplate(data as Record<string, unknown>);
    return {
      source: 'account',
      id: mapped.id,
      name: mapped.name,
      subject: mapped.subject,
      bodyHtml: mapped.bodyHtml,
      bodyText: mapped.bodyText,
      signature: mapped.signature,
    };
  }

  const { data } = await client
    .from('user_content_templates')
    .select('*')
    .eq('id', input.id)
    .maybeSingle();
  if (!data) return null;
  const mapped = mapUserTemplate(data as Record<string, unknown>);
  return {
    source: 'user',
    id: mapped.id,
    name: mapped.name,
    subject: null,
    bodyHtml: '',
    bodyText: mapped.bodyText,
    signature: null,
  };
}

export async function listTemplatesForPicker(
  client: SupabaseClient,
  input: {
    kind: ContentTemplateKind;
    accountId?: string | null;
    userId?: string | null;
  },
): Promise<PickerTemplate[]> {
  const items: PickerTemplate[] = [];

  const { data: systemRows } = await client
    .from('content_templates')
    .select('*')
    .eq('kind', input.kind)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  for (const row of systemRows ?? []) {
    const mapped = mapSystemTemplate(row as Record<string, unknown>);
    items.push({
      id: mapped.id,
      source: 'system',
      name: mapped.name,
      description: mapped.description,
      isDefault: false,
      kind: mapped.kind,
      subject: mapped.subject,
      bodyHtml: mapped.bodyHtml,
      bodyText: mapped.bodyText,
      signature: mapped.signature,
    });
  }

  if (
    input.accountId &&
    (input.kind === 'proposal_html' ||
      input.kind === 'proposal_email' ||
      input.kind === 'contract_email' ||
      input.kind === 'invoice_email' ||
      input.kind === 'survey_report_html')
  ) {
    const { data: accountRows } = await client
      .from('account_content_templates')
      .select('*')
      .eq('account_id', input.accountId)
      .eq('kind', input.kind as AccountTemplateKind)
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false });

    for (const row of accountRows ?? []) {
      const mapped = mapAccountTemplate(row as Record<string, unknown>);
      items.push({
        id: mapped.id,
        source: 'account',
        name: mapped.name,
        description: mapped.description,
        isDefault: mapped.isDefault,
        kind: mapped.kind,
        subject: mapped.subject,
        bodyHtml: mapped.bodyHtml,
        bodyText: mapped.bodyText,
        signature: mapped.signature,
      });
    }
  }

  if (input.userId && input.kind === 'email_reply') {
    const { data: userRows } = await client
      .from('user_content_templates')
      .select('*')
      .eq('user_id', input.userId)
      .eq('kind', 'email_reply')
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false });

    for (const row of userRows ?? []) {
      const mapped = mapUserTemplate(row as Record<string, unknown>);
      items.push({
        id: mapped.id,
        source: 'user',
        name: mapped.name,
        description: null,
        isDefault: mapped.isDefault,
        kind: 'email_reply',
        subject: null,
        bodyHtml: '',
        bodyText: mapped.bodyText,
        signature: null,
      });
    }
  }

  return items;
}
