import { z } from 'zod';

import {
  COMMERCIAL_SPACE,
  safeSearch,
  scopeWorkspaces,
} from './property-workspaces';
import { assertSupabaseOk, loadUserWorkspaces, toolJson } from './shared';
import type { OzerMcpToolRegistrar } from './types';

/*
 * Circulation (matching-disposal emails). Everything here is READ-ONLY by
 * design: marketing preferences and consent are legal records, so changes
 * must be made by the applicant (public preferences page) or in the app.
 * `public_access_token` is a credential for the applicant's private page and
 * is never returned.
 */

type Row = Record<string, unknown>;

const accountId = z
  .string()
  .uuid()
  .optional()
  .describe(
    'Commercial workspace id from list_workspaces. Omit to search every commercial workspace you belong to.',
  );
const limit = z.number().int().min(1).max(200).optional().default(50);

const PREFERENCE_COLUMNS =
  'id, account_id, client_id, email, purpose, marketing_status, auto_send_enabled, lawful_basis, consent_source, consent_copy_version, consented_at, unsubscribed_at, unsubscribe_source, unsubscribe_reviewed_at, suppressed_at, suppression_reason, last_digest_sent_at, created_at, updated_at';

export const MARKETING_STATUSES = [
  'subscribed',
  'unsubscribed',
  'suppressed',
  'pending',
] as const;

export const circulationSettingsSchema = z.object({ account_id: accountId });

export const listCirculationContactsSchema = z.object({
  account_id: accountId,
  status: z
    .string()
    .max(40)
    .optional()
    .describe(
      'Marketing status, e.g. subscribed, unsubscribed, suppressed. Omit for all.',
    ),
  auto_send_enabled: z.boolean().optional(),
  search: z.string().max(200).optional().describe('Match on email.'),
  limit,
});

export const getContactConsentSchema = z.object({
  account_id: accountId,
  email: z.string().email().describe('Contact email address.'),
});

export const listCirculationSendsSchema = z.object({
  account_id: accountId,
  listing_id: z.string().uuid().optional(),
  send_kind: z.string().max(40).optional(),
  send_trigger: z.enum(['manual', 'auto', 'dry_run']).optional(),
  limit,
});

export const getCirculationSendSchema = z.object({
  send_id: z.string().uuid(),
  recipient_limit: z.number().int().min(1).max(500).optional().default(200),
});

export const registerCirculationTools: OzerMcpToolRegistrar = (
  server,
  context,
) => {
  const { supabase, userId } = context;

  const scope = async (requested?: string) =>
    scopeWorkspaces(
      await loadUserWorkspaces(supabase, userId),
      COMMERCIAL_SPACE,
      requested,
    ).map((w) => w.id);

  server.registerTool(
    'get_circulation_settings',
    {
      description:
        'Read-only. Circulation settings per commercial workspace (auto-send on/off, minimum gap between emails) plus list counts by marketing status.',
      inputSchema: circulationSettingsSchema,
    },
    async (input) => {
      const ids = await scope(input.account_id);
      const [settings, prefs] = await Promise.all([
        supabase
          .from('commercial_circulation_settings')
          .select('account_id, auto_send_enabled, min_gap_days, updated_at')
          .in('account_id', ids),
        supabase
          .from('commercial_marketing_preferences')
          .select('account_id, marketing_status, auto_send_enabled')
          .in('account_id', ids)
          .limit(10000),
      ]);
      assertSupabaseOk(
        settings.data,
        settings.error,
        'load circulation settings',
      );
      assertSupabaseOk(prefs.data, prefs.error, 'load marketing preferences');

      const counts = new Map<string, Record<string, number>>();
      for (const p of (prefs.data ?? []) as Row[]) {
        const key = p.account_id as string;
        const c = counts.get(key) ?? {};
        const status = String(p.marketing_status);
        c[status] = (c[status] ?? 0) + 1;
        if (p.marketing_status === 'subscribed' && p.auto_send_enabled) {
          c.subscribed_auto_send = (c.subscribed_auto_send ?? 0) + 1;
        }
        counts.set(key, c);
      }
      const byAccount = new Map(
        ((settings.data ?? []) as Row[]).map((s) => [
          s.account_id as string,
          s,
        ]),
      );
      return toolJson({
        workspaces: ids.map((id) => ({
          account_id: id,
          // No row means the default: auto-send on.
          settings: byAccount.get(id) ?? null,
          contacts_by_status: counts.get(id) ?? {},
        })),
      });
    },
  );

  server.registerTool(
    'list_circulation_contacts',
    {
      description:
        'Read-only. People on the circulation list with their marketing preference and consent record (status, lawful basis, consent source/date, unsubscribe and suppression details) and when they were last emailed. Newest-updated first.',
      inputSchema: listCirculationContactsSchema,
    },
    async (input) => {
      const ids = await scope(input.account_id);
      let query = supabase
        .from('commercial_marketing_preferences')
        .select(PREFERENCE_COLUMNS)
        .in('account_id', ids)
        .order('updated_at', { ascending: false })
        .limit(input.limit);
      if (input.status) query = query.eq('marketing_status', input.status);
      if (input.auto_send_enabled !== undefined) {
        query = query.eq('auto_send_enabled', input.auto_send_enabled);
      }
      const search = input.search ? safeSearch(input.search) : '';
      if (search) query = query.ilike('email', `%${search}%`);
      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list circulation contacts');
      const rows = (data ?? []) as Row[];

      const emails = [...new Set(rows.map((r) => r.email as string))];
      const { data: state } = emails.length
        ? await supabase
            .from('commercial_circulation_contact_state')
            .select('account_id, email, last_circulated_at')
            .in('account_id', ids)
            .in('email', emails)
        : { data: [] };
      const lastSent = new Map(
        ((state ?? []) as Row[]).map((s) => [
          `${s.account_id}|${s.email}`,
          s.last_circulated_at,
        ]),
      );

      return toolJson({
        count: rows.length,
        contacts: rows.map((r) => ({
          ...r,
          last_circulated_at:
            lastSent.get(`${r.account_id}|${r.email}`) ?? null,
        })),
      });
    },
  );

  server.registerTool(
    'get_contact_consent',
    {
      description:
        'Read-only. The full consent and preference record for one email address: every purpose on file, lawful basis, where/when consent was given, unsubscribe/suppression history, send state, and the most recent circulation emails they received. Use this to answer "can we email this person?". No consent record means consent is unknown, not given.',
      inputSchema: getContactConsentSchema,
    },
    async (input) => {
      const ids = await scope(input.account_id);
      const email = input.email.trim().toLowerCase();
      const [prefs, state, sent] = await Promise.all([
        supabase
          .from('commercial_marketing_preferences')
          .select(PREFERENCE_COLUMNS)
          .in('account_id', ids)
          .ilike('email', email),
        supabase
          .from('commercial_circulation_contact_state')
          .select('account_id, email, last_circulated_at')
          .in('account_id', ids)
          .ilike('email', email),
        supabase
          .from('commercial_circulation_recipients')
          .select(
            'id, account_id, send_id, status, skip_reason, delivered_at, opened_at, clicked_at, bounced_at, bounce_type, complaint_at, created_at',
          )
          .in('account_id', ids)
          .ilike('email', email)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      assertSupabaseOk(prefs.data, prefs.error, 'load consent');
      assertSupabaseOk(state.data, state.error, 'load send state');
      assertSupabaseOk(sent.data, sent.error, 'load recent sends');

      const preferences = (prefs.data ?? []) as Row[];
      return toolJson({
        email,
        has_consent_record: preferences.length > 0,
        preferences,
        send_state: state.data ?? [],
        recent_emails: sent.data ?? [],
      });
    },
  );

  server.registerTool(
    'list_circulation_sends',
    {
      description:
        'Read-only. Circulation send log, newest first: subject, trigger (manual/auto/dry_run), listings covered, recipient count and delivery/open/click/bounce/complaint totals.',
      inputSchema: listCirculationSendsSchema,
    },
    async (input) => {
      const ids = await scope(input.account_id);
      let query = supabase
        .from('commercial_circulation_sends')
        .select(
          'id, account_id, listing_id, listing_ids, send_kind, send_trigger, subject, from_name, from_email, recipient_count, delivered_count, open_count, click_count, bounce_count, complaint_count, sent_by, created_at',
        )
        .in('account_id', ids)
        .order('created_at', { ascending: false })
        .limit(input.limit);
      if (input.listing_id) query = query.eq('listing_id', input.listing_id);
      if (input.send_kind) query = query.eq('send_kind', input.send_kind);
      if (input.send_trigger) {
        query = query.eq('send_trigger', input.send_trigger);
      }
      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list circulation sends');
      return toolJson({
        count: (data ?? []).length,
        sends: data ?? [],
      });
    },
  );

  server.registerTool(
    'get_circulation_send',
    {
      description:
        'Read-only. One circulation send with its per-recipient outcome (sent, skipped and why, delivered, opened, clicked, bounced, complained).',
      inputSchema: getCirculationSendSchema,
    },
    async (input) => {
      const ids = await scope();
      const { data: send, error } = await supabase
        .from('commercial_circulation_sends')
        .select('*')
        .eq('id', input.send_id)
        .in('account_id', ids)
        .maybeSingle();
      if (error) throw new Error(`Failed to load send: ${error.message}`);
      if (!send) throw new Error('Circulation send not found.');

      const { data: recipients, error: rErr } = await supabase
        .from('commercial_circulation_recipients')
        .select(
          'id, email, requirement_id, status, skip_reason, error_message, delivered_at, opened_at, open_count, clicked_at, click_count, bounced_at, bounce_type, bounce_subtype, complaint_at',
        )
        .eq('send_id', input.send_id)
        .order('created_at', { ascending: true })
        .limit(input.recipient_limit);
      assertSupabaseOk(recipients, rErr, 'load send recipients');
      return toolJson({ send, recipients: recipients ?? [] });
    },
  );
};
