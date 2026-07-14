import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { migrateSitemapDocument } from '~/lib/websites/sitemap-document';

export type WebsiteApprovalAction = 'approved' | 'changes_requested';
export type WebsiteApprovalTargetType = 'page' | 'section';
export type WebsiteApprovalActor = 'client' | 'agency';

export type WebsiteApprovalRecord = {
  id: string;
  accountId: string;
  websiteId: string;
  targetType: WebsiteApprovalTargetType;
  targetId: string;
  action: WebsiteApprovalAction;
  note: string | null;
  actor: WebsiteApprovalActor;
  createdAt: string;
  /** Resolved label for UI (page/section title when available). */
  targetLabel: string | null;
};

export type RecordWebsiteApprovalInput = {
  accountId: string;
  websiteId: string;
  targetType: WebsiteApprovalTargetType;
  targetId: string;
  /** Required when targetType is section (sitemap page that owns the section). */
  pageId?: string;
  status: 'approved' | 'blocked';
  note?: string | null;
  actor: WebsiteApprovalActor;
};

function approvalActionFromStatus(
  status: 'approved' | 'blocked',
): WebsiteApprovalAction {
  return status === 'approved' ? 'approved' : 'changes_requested';
}

function mapApprovalRow(
  row: Record<string, unknown>,
  targetLabel: string | null = null,
): WebsiteApprovalRecord {
  const targetType = String(row.target_type);
  const action = String(row.action);
  const actor = String(row.actor);

  if (targetType !== 'page' && targetType !== 'section') {
    throw new Error(`Unexpected approval target_type: ${targetType}`);
  }
  if (action !== 'approved' && action !== 'changes_requested') {
    throw new Error(`Unexpected approval action: ${action}`);
  }
  if (actor !== 'client' && actor !== 'agency') {
    throw new Error(`Unexpected approval actor: ${actor}`);
  }

  return {
    id: String(row.id),
    accountId: String(row.account_id),
    websiteId: String(row.website_id),
    targetType,
    targetId: String(row.target_id),
    action,
    note: row.note ? String(row.note) : null,
    actor,
    createdAt: String(row.created_at),
    targetLabel,
  };
}

export function createWebsiteApprovalsService(client: SupabaseClient) {
  return new WebsiteApprovalsService(client);
}

class WebsiteApprovalsService {
  constructor(private readonly client: SupabaseClient) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- H1 table pending typegen
  private get admin(): any {
    return getSupabaseServerAdminClient();
  }

  /**
   * Update sitemap JSONB status and append an audit row.
   * Uses admin client so share-token flows can write without authenticated RLS.
   */
  async recordApproval(
    input: RecordWebsiteApprovalInput,
  ): Promise<{ ok: true }> {
    const note =
      input.status === 'blocked'
        ? input.note?.trim().slice(0, 2000) || null
        : null;

    const { data: website, error: loadError } = await this.admin
      .from('websites')
      .select('id, sitemap')
      .eq('id', input.websiteId)
      .eq('business_id', input.accountId)
      .maybeSingle();

    if (loadError) throw loadError;
    if (!website) throw new Error('Website not found');

    const document = migrateSitemapDocument(website.sitemap);
    let found = false;

    if (input.targetType === 'page') {
      const nextPages = document.pages.map((page) => {
        if (page.id !== input.targetId) return page;
        found = true;
        return {
          ...page,
          status: input.status,
          approvalNote:
            input.status === 'approved' ? undefined : (note ?? undefined),
        };
      });
      if (!found) throw new Error('Page not found');
      document.pages = nextPages;
    } else {
      const pageId = input.pageId;
      const nextPages = document.pages.map((page) => {
        if (pageId && page.id !== pageId) return page;
        const hasSection = page.sections.some(
          (section) => section.id === input.targetId,
        );
        if (!hasSection) return page;
        found = true;
        return {
          ...page,
          sections: page.sections.map((section) =>
            section.id === input.targetId
              ? { ...section, status: input.status }
              : section,
          ),
        };
      });
      if (!found) throw new Error('Section not found');
      document.pages = nextPages;
    }

    const { error: updateError } = await this.admin
      .from('websites')
      .update({
        sitemap: document,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.websiteId)
      .eq('business_id', input.accountId);

    if (updateError) throw updateError;

    const { error: insertError } = await this.admin
      .from('website_approvals')
      .insert({
        account_id: input.accountId,
        website_id: input.websiteId,
        target_type: input.targetType,
        target_id: input.targetId,
        action: approvalActionFromStatus(input.status),
        note,
        actor: input.actor,
      });

    if (insertError) throw insertError;

    return { ok: true };
  }

  async listForWebsite(
    accountId: string,
    websiteId: string,
    limit = 40,
  ): Promise<WebsiteApprovalRecord[]> {
    const auth = await requireUser(this.client);
    if (!auth.data) throw new Error('Unauthorised');

    const { data: membership } = await this.client
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', auth.data.id)
      .maybeSingle();

    if (!membership) throw new Error('Forbidden');

    const { data, error } = await this.admin
      .from('website_approvals')
      .select(
        'id, account_id, website_id, target_type, target_id, action, note, actor, created_at',
      )
      .eq('account_id', accountId)
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const { data: website } = await this.admin
      .from('websites')
      .select('sitemap')
      .eq('id', websiteId)
      .eq('business_id', accountId)
      .maybeSingle();

    const document = migrateSitemapDocument(website?.sitemap);
    const labelById = new Map<string, string>();
    for (const page of document.pages) {
      labelById.set(page.id, page.title || 'Untitled page');
      for (const section of page.sections) {
        labelById.set(section.id, section.title || 'Untitled section');
      }
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
      mapApprovalRow(row, labelById.get(String(row.target_id)) ?? null),
    );
  }
}

/** Public share link → approve / request changes. */
export async function setShareApprovalByToken(input: {
  token: string;
  targetType: WebsiteApprovalTargetType;
  targetId: string;
  pageId?: string;
  status: 'approved' | 'blocked';
  note?: string;
}): Promise<{ ok: true }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- share columns pending typegen
  const admin = getSupabaseServerAdminClient() as any;

  const { data: share, error } = await admin
    .from('website_shares')
    .select('website_id, account_id, scope, expires_at, revoked_at')
    .eq('token', input.token)
    .maybeSingle();

  if (error || !share) throw new Error('Share link not found or expired');

  const shareRow = share as {
    website_id: string;
    account_id: string;
    scope: string;
    expires_at: string | null;
    revoked_at: string | null;
  };

  if (shareRow.revoked_at) throw new Error('Share link not found or expired');
  if (
    shareRow.expires_at &&
    new Date(shareRow.expires_at).getTime() < Date.now()
  ) {
    throw new Error('Share link not found or expired');
  }

  const allowedScopes = new Set(['sitemap', 'wireframes', 'design', 'full']);
  if (!allowedScopes.has(shareRow.scope)) {
    throw new Error('Share link does not allow approvals');
  }

  const service = createWebsiteApprovalsService(admin);
  return service.recordApproval({
    accountId: shareRow.account_id,
    websiteId: shareRow.website_id,
    targetType: input.targetType,
    targetId: input.targetId,
    pageId: input.pageId,
    status: input.status,
    note: input.note,
    actor: 'client',
  });
}

/** Authenticated portal member → approve / request changes. */
export async function setPortalWebsiteApproval(input: {
  clientOrgId: string;
  websiteId: string;
  targetType: WebsiteApprovalTargetType;
  targetId: string;
  pageId?: string;
  status: 'approved' | 'blocked';
  note?: string;
}): Promise<{ ok: true }> {
  const client = (
    await import('@kit/supabase/server-client')
  ).getSupabaseServerClient();
  const auth = await requireUser(client);
  if (!auth.data) throw new Error('Unauthorised');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- portal_share_scope pending typegen
  const admin = getSupabaseServerAdminClient() as any;

  const { data: member } = await admin
    .from('client_members')
    .select('id')
    .eq('client_org_id', input.clientOrgId)
    .eq('user_id', auth.data.id)
    .maybeSingle();

  if (!member) throw new Error('Forbidden');

  const { data: website } = await admin
    .from('websites')
    .select('id, business_id, client_org_id, portal_share_scope')
    .eq('id', input.websiteId)
    .maybeSingle();

  if (!website) throw new Error('Website not found');
  if (website.client_org_id !== input.clientOrgId) {
    throw new Error('Forbidden');
  }
  if (!website.portal_share_scope || website.portal_share_scope === 'off') {
    throw new Error('Planning review is not shared on the portal');
  }

  const service = createWebsiteApprovalsService(admin);
  return service.recordApproval({
    accountId: String(website.business_id),
    websiteId: input.websiteId,
    targetType: input.targetType,
    targetId: input.targetId,
    pageId: input.pageId,
    status: input.status,
    note: input.note,
    actor: 'client',
  });
}
