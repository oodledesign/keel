import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Data } from '@puckeditor/core';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { buildExport } from '~/lib/websites/export-contract';
import { generateOzerSitesPack } from '~/lib/websites/exporters/ozer-sites-pack';
import {
  type OzerSiteBundle,
  type OzerSitePageRecord,
  type OzerSiteRecord,
  type OzerSiteSettings,
  type PublishOzerSitesConflict,
  type PublishOzerSitesResult,
  emptyOzerSiteSettings,
  emptyPuckData,
  normalizeOzerSiteSettings,
  normalizePuckData,
  ozerSitePreviewUrl,
} from '~/lib/websites/ozer-sites-types';
import { normalizeWebsiteStyleTokens } from '~/lib/websites/style-tokens';

type Db = SupabaseClient;

function mapSite(row: Record<string, unknown>): OzerSiteRecord {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    websiteId: row.website_id ? String(row.website_id) : null,
    name: String(row.name ?? ''),
    primaryDomain: row.primary_domain ? String(row.primary_domain) : null,
    subdomain: String(row.subdomain ?? ''),
    status: (row.status as OzerSiteRecord['status']) ?? 'draft',
    themeTokens: normalizeWebsiteStyleTokens(row.theme_tokens),
    settings: normalizeOzerSiteSettings(row.settings),
    createdAt: String(row.created_at ?? ''),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function mapPage(row: Record<string, unknown>): OzerSitePageRecord {
  return {
    id: String(row.id),
    siteId: String(row.site_id),
    accountId: String(row.account_id),
    slug: String(row.slug ?? ''),
    title: String(row.title ?? ''),
    puckData: normalizePuckData(row.puck_data),
    status: (row.status as OzerSitePageRecord['status']) ?? 'draft',
    publishedData: row.published_data
      ? normalizePuckData(row.published_data)
      : null,
    sourceHash: row.source_hash ? String(row.source_hash) : null,
    humanEditedAt: row.human_edited_at ? String(row.human_edited_at) : null,
    updatedAt: String(row.updated_at ?? ''),
    publishedAt: row.published_at ? String(row.published_at) : null,
  };
}

export function createOzerSitesService(client: Db) {
  const adminDb = getSupabaseServerAdminClient() as Db;

  return {
    async ensureAgencyMember(accountId: string) {
      const auth = await requireUser(client);
      if (!auth.data) throw new Error('Unauthorised');
      const { data: membership } = await client
        .from('accounts_memberships')
        .select('account_role')
        .eq('account_id', accountId)
        .eq('user_id', auth.data.id)
        .maybeSingle();
      const role = membership?.account_role as string | undefined;
      if (!role || role === 'client' || role === 'contractor') {
        throw new Error('Forbidden');
      }
      return { userId: auth.data.id, role };
    },

    async ensurePortalMember(accountId: string, clientOrgId: string) {
      const auth = await requireUser(client);
      if (!auth.data) throw new Error('Unauthorised');
      const { data: member } = await client
        .from('client_members')
        .select('role')
        .eq('client_org_id', clientOrgId)
        .eq('user_id', auth.data.id)
        .maybeSingle();
      if (!member) throw new Error('Forbidden');
      return { userId: auth.data.id };
    },

    async getBundleForWebsite(
      accountId: string,
      websiteId: string,
      options?: { clientOrgId?: string },
    ): Promise<OzerSiteBundle> {
      if (options?.clientOrgId) {
        await this.ensurePortalMember(accountId, options.clientOrgId);
      } else {
        await this.ensureAgencyMember(accountId);
      }

      const db = options?.clientOrgId ? adminDb : client;

      const { data: siteRow } = await db
        .from('site_sites')
        .select('*')
        .eq('account_id', accountId)
        .eq('website_id', websiteId)
        .maybeSingle();

      if (!siteRow) {
        return { site: null, pages: [], domains: [] };
      }

      const site = mapSite(siteRow as Record<string, unknown>);
      if (
        options?.clientOrgId &&
        !normalizeOzerSiteSettings(site.settings).portalEditEnabled
      ) {
        return { site: null, pages: [], domains: [] };
      }

      const [{ data: pages }, { data: domains }] = await Promise.all([
        db
          .from('site_pages')
          .select('*')
          .eq('site_id', site.id)
          .order('slug', { ascending: true }),
        db.from('site_domains').select('*').eq('site_id', site.id),
      ]);

      return {
        site,
        pages: ((pages ?? []) as Array<Record<string, unknown>>).map(mapPage),
        domains: ((domains ?? []) as Array<Record<string, unknown>>).map(
          (row) => ({
            id: String(row.id),
            siteId: String(row.site_id),
            accountId: String(row.account_id),
            hostname: String(row.hostname),
            verifiedAt: row.verified_at ? String(row.verified_at) : null,
            isPrimary: Boolean(row.is_primary),
          }),
        ),
      };
    },

    /** Portal nav: whether Edit site should show (does not leak page drafts). */
    async getPortalEditAvailability(
      accountId: string,
      websiteId: string,
      clientOrgId: string,
    ): Promise<{ hasSite: boolean; portalEditEnabled: boolean }> {
      await this.ensurePortalMember(accountId, clientOrgId);
      const { data: siteRow } = await adminDb
        .from('site_sites')
        .select('settings')
        .eq('account_id', accountId)
        .eq('website_id', websiteId)
        .maybeSingle();
      if (!siteRow) {
        return { hasSite: false, portalEditEnabled: false };
      }
      return {
        hasSite: true,
        portalEditEnabled: normalizeOzerSiteSettings(siteRow.settings)
          .portalEditEnabled,
      };
    },

    async getSiteById(accountId: string, siteId: string) {
      const { data } = await adminDb
        .from('site_sites')
        .select('*')
        .eq('id', siteId)
        .eq('account_id', accountId)
        .maybeSingle();
      return data ? mapSite(data as Record<string, unknown>) : null;
    },

    async getPage(accountId: string, pageId: string) {
      const { data } = await adminDb
        .from('site_pages')
        .select('*')
        .eq('id', pageId)
        .eq('account_id', accountId)
        .maybeSingle();
      return data ? mapPage(data as Record<string, unknown>) : null;
    },

    async updateSettings(
      accountId: string,
      siteId: string,
      settings: Partial<OzerSiteSettings>,
    ) {
      await this.ensureAgencyMember(accountId);
      const site = await this.getSiteById(accountId, siteId);
      if (!site) throw new Error('Site not found');
      const next = {
        ...site.settings,
        ...settings,
        schemaVersion: '1.0' as const,
      };
      const { error } = await adminDb
        .from('site_sites')
        .update({ settings: next })
        .eq('id', siteId)
        .eq('account_id', accountId);
      if (error) throw error;
      return next;
    },

    /**
     * Publish SiteStudioExport into site_sites + site_pages.
     * Idempotent on drafts; conflicts when human_edited_at is set and hashes diverge
     * unless `resolveConflicts` maps pageId → 'overwrite' | 'skip'.
     */
    async publishFromWebsite(
      accountId: string,
      websiteId: string,
      options?: {
        resolveConflicts?: Record<string, 'overwrite' | 'skip'>;
        subdomain?: string;
      },
    ): Promise<PublishOzerSitesResult> {
      await this.ensureAgencyMember(accountId);
      const exp = await buildExport(websiteId);
      const pack = generateOzerSitesPack(exp);
      const subdomain = (options?.subdomain ?? pack.subdomain).toLowerCase();

      let { data: existing } = await adminDb
        .from('site_sites')
        .select('*')
        .eq('account_id', accountId)
        .eq('website_id', websiteId)
        .maybeSingle();

      if (!existing) {
        const { data: created, error } = await adminDb
          .from('site_sites')
          .insert({
            account_id: accountId,
            website_id: websiteId,
            name: pack.name,
            subdomain,
            status: 'live',
            theme_tokens: pack.themeTokens,
            settings: emptyOzerSiteSettings(),
          })
          .select('*')
          .single();
        if (error) throw error;
        existing = created;
      } else {
        const { error } = await adminDb
          .from('site_sites')
          .update({
            name: pack.name,
            theme_tokens: pack.themeTokens,
            status: 'live',
          })
          .eq('id', (existing as { id: string }).id);
        if (error) throw error;
      }

      const siteId = String((existing as { id: string }).id);
      const { data: currentPages } = await adminDb
        .from('site_pages')
        .select('*')
        .eq('site_id', siteId);

      const bySlug = new Map(
        ((currentPages ?? []) as Array<Record<string, unknown>>).map((row) => [
          String(row.slug),
          mapPage(row),
        ]),
      );

      const conflicts: PublishOzerSitesConflict[] = [];
      for (const page of pack.pages) {
        const current = bySlug.get(page.slug);
        if (
          current?.humanEditedAt &&
          current.sourceHash &&
          current.sourceHash !== page.sourceHash
        ) {
          const resolution = options?.resolveConflicts?.[current.id];
          if (!resolution) {
            conflicts.push({
              pageId: current.id,
              slug: page.slug,
              title: current.title || page.title,
              reason: 'human_edited',
              incomingHash: page.sourceHash,
              storedHash: current.sourceHash,
            });
          }
        }
      }

      if (conflicts.length > 0) {
        return { ok: false, conflicts };
      }

      const updatedPageIds: string[] = [];
      const createdPageIds: string[] = [];

      for (const page of pack.pages) {
        const current = bySlug.get(page.slug);
        const resolution = current
          ? options?.resolveConflicts?.[current.id]
          : undefined;

        if (resolution === 'skip') continue;

        if (current) {
          const { error } = await adminDb
            .from('site_pages')
            .update({
              title: page.title,
              puck_data: page.puckData,
              published_data: page.puckData,
              status: 'published',
              source_hash: page.sourceHash,
              human_edited_at: null,
              published_at: new Date().toISOString(),
            })
            .eq('id', current.id);
          if (error) throw error;
          updatedPageIds.push(current.id);
        } else {
          const { data: inserted, error } = await adminDb
            .from('site_pages')
            .insert({
              site_id: siteId,
              account_id: accountId,
              slug: page.slug,
              title: page.title,
              puck_data: page.puckData,
              published_data: page.puckData,
              status: 'published',
              source_hash: page.sourceHash,
              published_at: new Date().toISOString(),
            })
            .select('id')
            .single();
          if (error) throw error;
          createdPageIds.push(String(inserted.id));
        }
      }

      return {
        ok: true,
        siteId,
        subdomain,
        previewUrl: ozerSitePreviewUrl(subdomain),
        updatedPageIds,
        createdPageIds,
      };
    },

    /**
     * Draft write — caller must have already enforced agency/portal auth
     * (`ensureAgencyMember` / `ensurePortalMember` + `portalEditEnabled`).
     */
    async savePageDraft(
      accountId: string,
      pageId: string,
      puckData: Data,
      options?: { asHumanEdit?: boolean; title?: string },
    ) {
      const page = await this.getPage(accountId, pageId);
      if (!page) throw new Error('Page not found');

      const { error } = await adminDb
        .from('site_pages')
        .update({
          puck_data: puckData,
          title: options?.title ?? page.title,
          status: 'draft',
          human_edited_at: options?.asHumanEdit
            ? new Date().toISOString()
            : page.humanEditedAt,
        })
        .eq('id', pageId)
        .eq('account_id', accountId);
      if (error) throw error;
      return this.getPage(accountId, pageId);
    },

    /**
     * Publish write — caller must have already enforced agency/portal auth
     * (`ensureAgencyMember` / `ensurePortalMember` + `portalEditEnabled`).
     */
    async publishPage(accountId: string, pageId: string) {
      const page = await this.getPage(accountId, pageId);
      if (!page) throw new Error('Page not found');
      const now = new Date().toISOString();
      const { error } = await adminDb
        .from('site_pages')
        .update({
          published_data: page.puckData,
          status: 'published',
          published_at: now,
        })
        .eq('id', pageId)
        .eq('account_id', accountId);
      if (error) throw error;

      await adminDb
        .from('site_sites')
        .update({ status: 'live' })
        .eq('id', page.siteId)
        .eq('account_id', accountId);

      return this.getPage(accountId, pageId);
    },
  };
}

/** Public renderer lookup — service role only. */
export async function resolvePublishedSitePage(input: {
  hostname: string;
  slug: string;
}) {
  const adminDb = getSupabaseServerAdminClient() as Db;
  const host = input.hostname.toLowerCase().replace(/:\d+$/, '');
  const root =
    process.env.NEXT_PUBLIC_OZER_SITES_ROOT_DOMAIN?.trim() || 'sites.ozer.so';

  let siteId: string | null = null;

  const { data: domain } = await adminDb
    .from('site_domains')
    .select('site_id, verified_at')
    .eq('hostname', host)
    .maybeSingle();

  if (domain?.site_id && domain.verified_at) {
    siteId = String(domain.site_id);
  } else if (host.endsWith(`.${root}`) || host === root) {
    const sub = host === root ? '' : host.slice(0, -(root.length + 1));
    if (sub) {
      const { data: site } = await adminDb
        .from('site_sites')
        .select('id, status')
        .eq('subdomain', sub)
        .maybeSingle();
      if (site && site.status === 'live') siteId = String(site.id);
    }
  }

  if (!siteId) return null;

  const { data: site } = await adminDb
    .from('site_sites')
    .select('*')
    .eq('id', siteId)
    .maybeSingle();
  if (!site || site.status !== 'live') return null;

  const slug =
    !input.slug || input.slug === '/' || input.slug === 'index'
      ? 'home'
      : input.slug.replace(/^\//, '').split('/')[0] || 'home';

  const { data: page } = await adminDb
    .from('site_pages')
    .select('*')
    .eq('site_id', siteId)
    .eq('slug', slug)
    .maybeSingle();

  if (!page?.published_data) return null;

  return {
    site: mapSite(site as Record<string, unknown>),
    page: mapPage(page as Record<string, unknown>),
    data: normalizePuckData(page.published_data) ?? emptyPuckData(),
  };
}
