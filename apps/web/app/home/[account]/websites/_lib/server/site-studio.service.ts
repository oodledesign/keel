import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { randomBytes } from 'crypto';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { FEATURE_CONFIG, callAI } from '~/lib/ai/router';
import { canUseAddon } from '~/lib/billing/entitlements';
import {
  type BriefAiSource,
  type WebsiteBrief,
  type WebsiteBriefAiProvenance,
  applyBriefPatch,
  confirmBriefAiPaths,
  emptyBriefAiProvenance,
  emptyWebsiteBrief,
  markBriefPathsHumanEdited,
  mergeBriefSuggestion,
  normalizeBriefAiProvenance,
  normalizeWebsiteBrief,
} from '~/lib/websites/brief-types';
import { fetchUrlContentForBrief } from '~/lib/websites/fetch-url-for-brief';
import { hasSiteStudio } from '~/lib/websites/has-site-studio';
import {
  type SiteStudioBundle,
  type WebsitePortalShareScope,
  type WebsiteShareLink,
  type WebsiteShareScope,
  type WebsiteSitemapPage,
  type WebsiteStyleSystem,
  type WebsiteWireframePage,
  createPlanningId,
  emptySiteStudioBundle,
  emptyWebsiteStyleSystem,
  normalizeWebsiteStyleSystem,
  normalizeWebsiteStyleTokens,
  styleSystemFromDbRow,
  wireframesForClientShare,
} from '~/lib/websites/planning-types';
import { toLegacyFlatSeoFields } from '~/lib/websites/seo-legacy-flat';
import {
  type WebsiteSeoPageRecord,
  type WebsiteSeoPageSeo,
  type WebsiteSeoStatus,
  normalizeWebsiteSeoPageRecord,
  normalizeWebsiteSeoPageSeo,
} from '~/lib/websites/seo-types';
import type {
  SitemapProposal,
  SitemapProposeMode,
  WireframePageProposal,
  WireframeSectionProposal,
} from '~/lib/websites/site-studio-ai-types';
import { SITE_STUDIO_AI_CREDITS } from '~/lib/websites/site-studio-credits';
import {
  AiSitemapPagesSchema,
  AiWireframeSectionsSchema,
  materialiseAiSitemapPages,
  materialiseAiWireframeSections,
} from '~/lib/websites/sitemap-ai-parse';
import {
  migrateSitemapDocument,
  migrateSitemapPages,
} from '~/lib/websites/sitemap-document';

import {
  isMissingColumnError,
  isMissingRelationError,
  logMissingRelation,
} from '../../../_lib/server/supabase-errors';
import {
  BRIEF_EXTRACT_SYSTEM,
  BRIEF_SUGGEST_SYSTEM,
  SEO_ANSWER_BLOCKS_SYSTEM,
  SEO_GENERATE_SYSTEM,
  SITEMAP_GENERATE_SYSTEM,
  SITEMAP_SEO_PAGES_SYSTEM,
  SITEMAP_VARIANTS_SYSTEM,
  STYLE_SUGGEST_SYSTEM,
  WIREFRAME_GENERATE_SYSTEM,
  WIREFRAME_SECTION_REGENERATE_SYSTEM,
  briefContextBlock,
  callAIValidatedJson,
  extractJson,
  sitemapContextBlock,
} from './site-studio-ai';

export type {
  SitemapProposeMode,
  SitemapProposal,
  WireframePageProposal,
  WireframeSectionProposal,
} from '~/lib/websites/site-studio-ai-types';

export type { SiteStudioBundle } from '~/lib/websites/planning-types';
export { emptySiteStudioBundle } from '~/lib/websites/planning-types';

function generateShareToken() {
  return randomBytes(32).toString('hex');
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
}

export function websiteShareUrl(token: string) {
  return `${siteUrl()}/portal/websites/${encodeURIComponent(token)}`;
}

/** Chrome-less wireframe URL for html.to.design / PNG capture (Tier 1). */
export function websiteShareFigmaPageUrl(token: string, pageSlug: string) {
  const slug =
    pageSlug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'home';
  return `${websiteShareUrl(token)}/figma/${encodeURIComponent(slug)}`;
}

export function createSiteStudioService(client: SupabaseClient) {
  return new SiteStudioService(client);
}

class SiteStudioService {
  constructor(private readonly client: SupabaseClient) {}

  private get adminDb(): SupabaseClient {
    return getSupabaseServerAdminClient();
  }

  private async ensureUser() {
    const { data: user } = await requireUser(this.client);
    if (!user) throw new Error('Authentication required');
    return user;
  }

  private async ensureCanView(accountId: string) {
    const user = await this.ensureUser();
    const { data, error } = await this.client
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    const role = data?.account_role;
    if (!role || role === 'contractor' || role === 'client') {
      throw new Error('Permission denied');
    }
    return user;
  }

  private async ensureCanEdit(accountId: string) {
    const user = await this.ensureUser();
    const api = createTeamAccountsApi(this.client);
    const allowed = await api.hasPermission({
      userId: user.id,
      accountId,
      permission: 'jobs.edit',
    });

    if (!allowed) {
      throw new Error('Permission denied');
    }

    // Match website_briefs RLS: contractors cannot write even with jobs.edit.
    const { data, error } = await this.client
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (
      data?.account_role === 'contractor' ||
      data?.account_role === 'client'
    ) {
      throw new Error('Permission denied');
    }

    return user;
  }

  private async ensureSiteStudio(accountId: string) {
    const user = await this.ensureCanEdit(accountId);
    const allowed = await canUseAddon(
      this.client,
      user.id,
      accountId,
      'addon_site_studio',
    );

    if (!allowed) {
      throw new Error(
        'Site Studio add-on required. Subscribe from Billing in this workspace.',
      );
    }

    return user;
  }

  private async verifyWebsite(accountId: string, websiteId: string) {
    const full = await this.client
      .from('websites')
      .select('id, name, domain, client_org_id, job_id, sitemap, wireframes')
      .eq('id', websiteId)
      .eq('business_id', accountId)
      .maybeSingle();

    if (full.error && isMissingColumnError(full.error)) {
      logMissingRelation('site_studio.verifyWebsite', full.error);

      const fallback = await this.client
        .from('websites')
        .select('id, name, domain, client_org_id')
        .eq('id', websiteId)
        .eq('business_id', accountId)
        .maybeSingle();

      if (fallback.error) throw fallback.error;
      if (!fallback.data) throw new Error('Website not found');

      return {
        ...(fallback.data as {
          id: string;
          name: string | null;
          domain: string | null;
          client_org_id: string | null;
        }),
        job_id: null,
        sitemap: [],
        wireframes: [],
      };
    }

    if (full.error) throw full.error;
    if (!full.data) throw new Error('Website not found');

    return full.data as {
      id: string;
      name: string | null;
      domain: string | null;
      client_org_id: string | null;
      job_id: string | null;
      sitemap: unknown;
      wireframes: unknown;
    };
  }

  /* ---------------------------------------------------------------- */
  /* Bundle                                                            */
  /* ---------------------------------------------------------------- */

  async getBundle(
    accountId: string,
    websiteId: string,
    /** Pre-resolved entitlement — avoids a second hasSiteStudio() round-trip. */
    siteStudioEnabled?: boolean,
  ): Promise<SiteStudioBundle> {
    await this.ensureCanView(accountId);
    const enabled = siteStudioEnabled ?? (await hasSiteStudio(accountId));

    const bundle = emptySiteStudioBundle();
    bundle.enabled = enabled;

    const [briefRes, styleRes, seoRes, sharesRes, websiteRes] =
      await Promise.all([
        this.client
          .from('website_briefs')
          .select('brief, ai_provenance, llms_txt')
          .eq('website_id', websiteId)
          .eq('account_id', accountId)
          .maybeSingle(),
        this.client
          .from('website_style_systems')
          .select('style, tokens, moodboard, locked')
          .eq('website_id', websiteId)
          .eq('account_id', accountId)
          .maybeSingle(),
        this.client
          .from('website_seo_pages')
          .select('page_id, page_slug, fields, seo, status')
          .eq('website_id', websiteId)
          .eq('account_id', accountId),
        this.client
          .from('website_shares')
          .select('id, token, scope, expires_at, revoked_at, created_at')
          .eq('website_id', websiteId)
          .eq('account_id', accountId)
          .is('revoked_at', null)
          .order('created_at', { ascending: false }),
        this.client
          .from('websites')
          .select('portal_share_scope')
          .eq('id', websiteId)
          .eq('business_id', accountId)
          .maybeSingle(),
      ]);

    for (const res of [styleRes, sharesRes]) {
      if (res.error && isMissingRelationError(res.error)) {
        logMissingRelation('site_studio.getBundle', res.error);
        return bundle;
      }
    }

    if (seoRes.error && isMissingRelationError(seoRes.error)) {
      logMissingRelation('site_studio.getBundle', seoRes.error);
      return bundle;
    }

    let seoRows = (seoRes.data ?? []) as Array<{
      page_id: string;
      page_slug?: string | null;
      fields?: unknown;
      seo?: unknown;
      status?: string | null;
    }>;

    if (seoRes.error && isMissingColumnError(seoRes.error)) {
      const legacySeo = await this.client
        .from('website_seo_pages')
        .select('page_id, fields')
        .eq('website_id', websiteId)
        .eq('account_id', accountId);
      if (legacySeo.error && isMissingRelationError(legacySeo.error)) {
        logMissingRelation('site_studio.getBundle', legacySeo.error);
        return bundle;
      }
      seoRows = (
        (legacySeo.data ?? []) as Array<{
          page_id: string;
          fields?: unknown;
        }>
      ).map((row) => ({
        page_id: row.page_id,
        page_slug: null,
        fields: row.fields,
        seo: null,
        status: 'draft',
      }));
    }

    let briefRow = briefRes.data as {
      brief?: unknown;
      ai_provenance?: unknown;
      llms_txt?: string | null;
    } | null;

    if (briefRes.error && isMissingColumnError(briefRes.error)) {
      const legacyBrief = await this.client
        .from('website_briefs')
        .select('brief, ai_provenance')
        .eq('website_id', websiteId)
        .eq('account_id', accountId)
        .maybeSingle();
      if (legacyBrief.error && isMissingRelationError(legacyBrief.error)) {
        logMissingRelation('site_studio.getBundle', legacyBrief.error);
        return bundle;
      }
      briefRow = legacyBrief.data as {
        brief?: unknown;
        ai_provenance?: unknown;
      } | null;
    } else if (briefRes.error && isMissingRelationError(briefRes.error)) {
      logMissingRelation('site_studio.getBundle', briefRes.error);
      return bundle;
    }

    if (briefRow?.brief && typeof briefRow.brief === 'object') {
      bundle.brief = normalizeWebsiteBrief(briefRow.brief);
    }

    if (briefRow?.ai_provenance) {
      bundle.briefProvenance = normalizeBriefAiProvenance(
        briefRow.ai_provenance,
      );
    }

    if (typeof briefRow?.llms_txt === 'string' && briefRow.llms_txt.trim()) {
      bundle.llmsTxt = briefRow.llms_txt;
    }

    if (styleRes.data) {
      bundle.style = styleSystemFromDbRow(
        styleRes.data as {
          style?: unknown;
          tokens?: unknown;
          moodboard?: unknown;
          locked?: unknown;
        },
      );
    }

    for (const row of seoRows) {
      bundle.seoPages[row.page_id] = normalizeWebsiteSeoPageRecord(
        {
          page_id: row.page_id,
          page_slug: row.page_slug,
          seo: row.seo,
          fields: row.fields,
          status: row.status,
        },
        row.page_id,
        row.page_slug ?? '',
      );
    }

    bundle.shares = (
      (sharesRes.data ?? []) as Array<{
        id: string;
        token: string;
        scope: string;
        expires_at: string | null;
        created_at: string;
      }>
    ).map((row) => ({
      id: row.id,
      token: row.token,
      scope: row.scope as WebsiteShareScope,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));

    const portalScope = (
      websiteRes.data as { portal_share_scope?: string } | null
    )?.portal_share_scope;
    if (
      portalScope === 'sitemap' ||
      portalScope === 'wireframes' ||
      portalScope === 'full'
    ) {
      bundle.portalScope = portalScope;
    }

    const siteRes = await this.client
      .from('site_sites')
      .select('id')
      .eq('account_id', accountId)
      .eq('website_id', websiteId)
      .maybeSingle();
    if (!siteRes.error && siteRes.data) {
      bundle.hasOzerSite = true;
    } else if (siteRes.error && isMissingRelationError(siteRes.error)) {
      logMissingRelation('site_studio.getBundle.site_sites', siteRes.error);
    }

    return bundle;
  }

  /* ---------------------------------------------------------------- */
  /* Brief                                                             */
  /* ---------------------------------------------------------------- */

  async saveBrief(accountId: string, websiteId: string, brief: WebsiteBrief) {
    const user = await this.ensureSiteStudio(accountId);
    await this.verifyWebsite(accountId, websiteId);

    const normalized = normalizeWebsiteBrief(brief);
    const { error } = await this.adminDb.from('website_briefs').upsert(
      {
        account_id: accountId,
        website_id: websiteId,
        brief: normalized,
        created_by: user.id,
      },
      { onConflict: 'website_id' },
    );

    if (error) throw error;
    return { ok: true as const, brief: normalized };
  }

  async patchBrief(
    accountId: string,
    websiteId: string,
    patch: Record<string, unknown>,
    editedPaths: string[] = [],
  ) {
    const user = await this.ensureSiteStudio(accountId);
    await this.verifyWebsite(accountId, websiteId);

    const loaded = await this.loadBriefRow(accountId, websiteId);
    const current = loaded?.brief ?? emptyWebsiteBrief();
    const next = applyBriefPatch(current, patch);
    const provenance = markBriefPathsHumanEdited(
      loaded?.provenance ?? emptyBriefAiProvenance(),
      editedPaths,
    );

    const { error } = await this.adminDb.from('website_briefs').upsert(
      {
        account_id: accountId,
        website_id: websiteId,
        brief: next,
        ai_provenance: provenance,
        created_by: user.id,
      },
      { onConflict: 'website_id' },
    );

    if (error) throw error;
    return { ok: true as const, brief: next, provenance };
  }

  async confirmBriefAiFields(
    accountId: string,
    websiteId: string,
    paths: string[],
  ) {
    const user = await this.ensureSiteStudio(accountId);
    await this.verifyWebsite(accountId, websiteId);

    const loaded = await this.loadBriefRow(accountId, websiteId);
    if (!loaded) {
      throw new Error('Brief not found');
    }

    const provenance = confirmBriefAiPaths(loaded.provenance, paths);
    const { error } = await this.adminDb.from('website_briefs').upsert(
      {
        account_id: accountId,
        website_id: websiteId,
        brief: loaded.brief,
        ai_provenance: provenance,
        created_by: user.id,
      },
      { onConflict: 'website_id' },
    );

    if (error) throw error;
    return { ok: true as const, provenance };
  }

  private async loadBriefRow(
    accountId: string,
    websiteId: string,
  ): Promise<{
    brief: WebsiteBrief;
    provenance: WebsiteBriefAiProvenance;
  } | null> {
    const { data } = await this.client
      .from('website_briefs')
      .select('brief, ai_provenance')
      .eq('website_id', websiteId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (!data?.brief || typeof data.brief !== 'object') return null;
    return {
      brief: normalizeWebsiteBrief(data.brief),
      provenance: normalizeBriefAiProvenance(data.ai_provenance),
    };
  }

  private async loadBrief(
    accountId: string,
    websiteId: string,
  ): Promise<WebsiteBrief | null> {
    const row = await this.loadBriefRow(accountId, websiteId);
    return row?.brief ?? null;
  }

  async suggestBrief(
    accountId: string,
    websiteId: string,
    input: {
      source: BriefAiSource;
      notes?: string;
      websiteUrl?: string;
      confirmOverwritePaths?: string[];
    },
  ): Promise<{
    brief: WebsiteBrief;
    provenance: WebsiteBriefAiProvenance;
    appliedPaths: string[];
    skippedPaths: string[];
  }> {
    const user = await this.ensureSiteStudio(accountId);
    const website = await this.verifyWebsite(accountId, websiteId);
    const existing = await this.loadBriefRow(accountId, websiteId);
    const current = existing?.brief ?? emptyWebsiteBrief();
    const provenance = existing?.provenance ?? emptyBriefAiProvenance();

    let sourceContext = '';
    let scrapeMeta = '';

    if (input.source === 'notes') {
      if (!input.notes?.trim()) {
        throw new Error('Paste discovery notes before suggesting from notes');
      }
      sourceContext = `Discovery notes:\n${input.notes.trim()}`;
    } else if (input.source === 'url') {
      const url = input.websiteUrl?.trim() || website.domain || '';
      if (!url) {
        throw new Error('Provide a website URL to suggest from');
      }
      const scraped = await fetchUrlContentForBrief(url);
      if (!scraped.text) {
        throw new Error('Could not extract content from that URL');
      }
      scrapeMeta = `Fetched via ${scraped.method}${scraped.title ? ` — ${scraped.title}` : ''}`;
      sourceContext = `Website URL: ${scraped.normalizedUrl}\n${scrapeMeta}\n\nExtracted page text:\n${scraped.text}`;
    } else {
      if (!website.client_org_id) {
        throw new Error(
          'Link a client organisation to this website first (Edit website)',
        );
      }
      const { data: org } = await this.client
        .from('client_orgs')
        .select('name, industry, notes, website')
        .eq('id', website.client_org_id)
        .maybeSingle();

      if (!org) {
        throw new Error('Linked client organisation not found');
      }

      const orgRow = org as {
        name?: string | null;
        industry?: string | null;
        notes?: string | null;
        website?: string | null;
      };

      sourceContext = [
        'CRM / client organisation fields:',
        `Name: ${orgRow.name ?? 'n/a'}`,
        `Industry / sector: ${orgRow.industry ?? 'n/a'}`,
        `Website: ${orgRow.website ?? 'n/a'}`,
        `Notes: ${orgRow.notes ?? 'n/a'}`,
        website.name ? `Website record name: ${website.name}` : null,
        website.domain ? `Website domain: ${website.domain}` : null,
      ]
        .filter(Boolean)
        .join('\n');
    }

    const extractPrompt = [
      `Suggest source: ${input.source}`,
      website.name ? `Website record name: ${website.name}` : null,
      sourceContext,
      'Extract factual brief signals as JSON now.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const extractText = await callAI({
      feature: 'website_brief_extract',
      systemPrompt: BRIEF_EXTRACT_SYSTEM,
      userPrompt: extractPrompt,
      accountId,
      supabase: this.client,
    });

    const extractModel = FEATURE_CONFIG.website_brief_extract.model;
    const synthesizeModel = FEATURE_CONFIG.website_brief_suggest.model;

    const synthesizePrompt = [
      `Suggest source: ${input.source}`,
      scrapeMeta || null,
      'Extracted signals JSON:',
      extractText,
      'Raw source context (for grounding):',
      sourceContext.slice(0, 8000),
      'Draft the structured WebsiteBrief JSON (schemaVersion 1.0) now.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const synthesizeText = await callAI({
      feature: 'website_brief_suggest',
      systemPrompt: BRIEF_SUGGEST_SYSTEM,
      userPrompt: synthesizePrompt,
      accountId,
      supabase: this.client,
    });

    const suggestedRaw = extractJson<unknown>(synthesizeText);
    const suggested = normalizeWebsiteBrief(suggestedRaw);

    if (input.source === 'url' && input.websiteUrl?.trim()) {
      if (!suggested.brand.existingSiteUrl) {
        suggested.brand.existingSiteUrl = input.websiteUrl.trim();
      }
    }

    const merge = mergeBriefSuggestion({
      current,
      suggested,
      source: input.source,
      model: synthesizeModel,
      provenance,
      confirmOverwritePaths: input.confirmOverwritePaths,
    });

    merge.provenance.lastRun = {
      source: input.source,
      extractModel,
      synthesizeModel,
      at: new Date().toISOString(),
    };

    const { error } = await this.adminDb.from('website_briefs').upsert(
      {
        account_id: accountId,
        website_id: websiteId,
        brief: merge.brief,
        ai_provenance: merge.provenance,
        created_by: user.id,
      },
      { onConflict: 'website_id' },
    );

    if (error) throw error;

    return {
      brief: merge.brief,
      provenance: merge.provenance,
      appliedPaths: merge.appliedPaths,
      skippedPaths: merge.skippedPaths,
    };
  }

  /* ---------------------------------------------------------------- */
  /* AI sitemap (propose only — client applies after preview)           */
  /* ---------------------------------------------------------------- */

  async proposeSitemap(
    accountId: string,
    websiteId: string,
    mode: SitemapProposeMode,
  ): Promise<SitemapProposal> {
    await this.ensureSiteStudio(accountId);
    const website = await this.verifyWebsite(accountId, websiteId);
    const brief = await this.loadBrief(accountId, websiteId);

    const currentDoc = migrateSitemapDocument(website.sitemap);
    const currentSitemap = currentDoc.pages;

    const systemPrompt =
      mode === 'add-missing-seo-pages'
        ? SITEMAP_SEO_PAGES_SYSTEM
        : mode === 'local-service-variants'
          ? SITEMAP_VARIANTS_SYSTEM
          : SITEMAP_GENERATE_SYSTEM;

    const userPromptParts = [
      `Brief:\n${briefContextBlock(brief)}`,
      mode === 'from-brief'
        ? currentSitemap.length > 0
          ? `Current sitemap (for awareness — your proposal will REPLACE it if the user applies):\n${sitemapContextBlock(currentSitemap)}\n\nPropose a complete replacement sitemap.`
          : 'Propose the full sitemap for this site.'
        : `Current sitemap:\n${sitemapContextBlock(currentSitemap)}`,
      mode === 'add-missing-seo-pages'
        ? 'Propose ONLY missing SEO/local/legal/comparison pages with seoIntent filled. Return new pages only.'
        : null,
      mode === 'local-service-variants'
        ? 'Propose the service × geography variant matrix as child pages (parentSlug required). Return new variant pages only.'
        : null,
    ];

    const rawPages = await callAIValidatedJson({
      feature: 'website_sitemap_generate',
      systemPrompt,
      userPrompt: userPromptParts.filter(Boolean).join('\n\n'),
      accountId,
      supabase: this.client,
      schema: AiSitemapPagesSchema,
    });

    const existingForParents = mode === 'from-brief' ? [] : currentSitemap;

    let pages = materialiseAiSitemapPages(rawPages, {
      existingPages: existingForParents,
    });

    const skippedExistingSlugs: string[] = [];
    if (mode !== 'from-brief') {
      const existingSlugs = new Set(currentSitemap.map((page) => page.slug));
      const filtered: WebsiteSitemapPage[] = [];
      for (const page of pages) {
        if (existingSlugs.has(page.slug)) {
          skippedExistingSlugs.push(page.slug);
        } else {
          filtered.push(page);
        }
      }
      pages = filtered;
    }

    if (pages.length === 0) {
      throw new Error(
        mode === 'from-brief'
          ? 'AI did not return any pages'
          : 'No new pages to add — sitemap already covers these intents',
      );
    }

    return {
      mode,
      pages,
      currentPageCount: currentSitemap.length,
      skippedExistingSlugs,
      creditsUsed: SITE_STUDIO_AI_CREDITS.sitemapGenerate,
    };
  }

  /**
   * @deprecated Prefer proposeSitemap + client apply. Kept for any callers
   * expecting immediate persist — now proposes and refuses silent replace.
   */
  async generateSitemap(
    accountId: string,
    websiteId: string,
    mode: 'replace' | 'add-missing-seo-pages',
  ): Promise<WebsiteSitemapPage[]> {
    const mapped: SitemapProposeMode =
      mode === 'replace' ? 'from-brief' : 'add-missing-seo-pages';
    const proposal = await this.proposeSitemap(accountId, websiteId, mapped);
    // Do not persist — return proposed pages so callers must apply explicitly.
    return proposal.pages;
  }

  /* ---------------------------------------------------------------- */
  /* AI wireframes (propose only — client applies after preview)       */
  /* ---------------------------------------------------------------- */

  async proposeWireframesForPage(
    accountId: string,
    websiteId: string,
    pageId: string,
  ): Promise<WireframePageProposal> {
    await this.ensureSiteStudio(accountId);
    const website = await this.verifyWebsite(accountId, websiteId);
    const brief = await this.loadBrief(accountId, websiteId);

    const sitemap = migrateSitemapPages(website.sitemap);
    const page = sitemap.find((item) => item.id === pageId);
    if (!page) throw new Error('Sitemap page not found');
    if (page.sections.length === 0) {
      throw new Error('Add sections to this page in the sitemap first');
    }

    const rawSections = await callAIValidatedJson({
      feature: 'website_wireframe_generate',
      systemPrompt: WIREFRAME_GENERATE_SYSTEM,
      userPrompt: [
        `Brief:\n${briefContextBlock(brief)}`,
        `Page: ${page.title} (/${page.slug})${page.seoIntent ? ` — intent: ${page.seoIntent}` : ''}`,
        `Sitemap sections (in order):\n${page.sections
          .map((section) => `- ${section.title}: ${section.description}`)
          .join('\n')}`,
        'Produce the wireframe spec JSON now.',
      ].join('\n\n'),
      accountId,
      supabase: this.client,
      schema: AiWireframeSectionsSchema,
    });

    const existing = Array.isArray(website.wireframes)
      ? (website.wireframes as WebsiteWireframePage[])
      : [];
    const existingPage = existing.find((item) => item.pageId === pageId);
    const existingBySitemapSectionId = new Map(
      (existingPage?.sections ?? [])
        .filter((section) => section.sitemapSectionId)
        .map((section) => [section.sitemapSectionId as string, section]),
    );

    const sections = materialiseAiWireframeSections({
      sitemapSections: page.sections.map((section) => ({
        id: section.id,
        title: section.title,
        description: section.description,
      })),
      rawSections,
      existingBySitemapSectionId,
    });

    return {
      page: {
        id: existingPage?.id ?? createPlanningId(),
        pageId,
        title: page.title,
        sections,
      },
      creditsUsed: SITE_STUDIO_AI_CREDITS.wireframeGenerate,
    };
  }

  async proposeWireframeSection(
    accountId: string,
    websiteId: string,
    pageId: string,
    sectionId: string,
  ): Promise<WireframeSectionProposal> {
    await this.ensureSiteStudio(accountId);
    const website = await this.verifyWebsite(accountId, websiteId);
    const brief = await this.loadBrief(accountId, websiteId);

    const sitemap = migrateSitemapPages(website.sitemap);
    const page = sitemap.find((item) => item.id === pageId);
    if (!page) throw new Error('Sitemap page not found');

    const existing = Array.isArray(website.wireframes)
      ? (website.wireframes as WebsiteWireframePage[])
      : [];
    const wireframePage = existing.find((item) => item.pageId === pageId);
    const wireframeSection = wireframePage?.sections.find(
      (section) => section.id === sectionId,
    );
    if (!wireframeSection) {
      throw new Error('Wireframe section not found — generate the page first');
    }

    const sitemapSection =
      page.sections.find(
        (section) => section.id === wireframeSection.sitemapSectionId,
      ) ?? null;

    const targetTitle = sitemapSection?.title ?? wireframeSection.title;
    const targetDescription =
      sitemapSection?.description ?? wireframeSection.contentNotes;

    const rawSections = await callAIValidatedJson({
      feature: 'website_wireframe_generate',
      systemPrompt: WIREFRAME_SECTION_REGENERATE_SYSTEM,
      userPrompt: [
        `Brief:\n${briefContextBlock(brief)}`,
        `Page: ${page.title} (/${page.slug})`,
        `Regenerate ONLY this section: ${targetTitle}`,
        `Section purpose: ${targetDescription}`,
        `Current layout: ${wireframeSection.layout}`,
        `Current libraryKey: ${wireframeSection.libraryKey ?? 'none'}`,
        'Produce a one-item wireframe JSON array now.',
      ].join('\n\n'),
      accountId,
      supabase: this.client,
      schema: AiWireframeSectionsSchema,
    });

    const [section] = materialiseAiWireframeSections({
      sitemapSections: [
        {
          id: wireframeSection.sitemapSectionId ?? wireframeSection.id,
          title: targetTitle,
          description: targetDescription,
        },
      ],
      rawSections,
      existingBySitemapSectionId: new Map([
        [
          wireframeSection.sitemapSectionId ?? wireframeSection.id,
          wireframeSection,
        ],
      ]),
    });

    if (!section) {
      throw new Error('AI did not return a regenerated section');
    }

    return {
      pageId,
      section: { ...section, id: wireframeSection.id },
      creditsUsed: SITE_STUDIO_AI_CREDITS.wireframeGenerate,
    };
  }

  async generateWireframesForPage(
    accountId: string,
    websiteId: string,
    pageId: string,
  ): Promise<WebsiteWireframePage[]> {
    const proposal = await this.proposeWireframesForPage(
      accountId,
      websiteId,
      pageId,
    );
    const website = await this.verifyWebsite(accountId, websiteId);
    const existing = Array.isArray(website.wireframes)
      ? (website.wireframes as WebsiteWireframePage[])
      : [];

    return existing.some((item) => item.pageId === pageId)
      ? existing.map((item) => (item.pageId === pageId ? proposal.page : item))
      : [...existing, proposal.page];
  }

  /* ---------------------------------------------------------------- */
  /* Style system                                                      */
  /* ---------------------------------------------------------------- */

  async saveStyleSystem(
    accountId: string,
    websiteId: string,
    style: WebsiteStyleSystem,
  ) {
    const user = await this.ensureSiteStudio(accountId);
    await this.verifyWebsite(accountId, websiteId);

    const normalised = normalizeWebsiteStyleSystem(style);

    const { error } = await this.adminDb.from('website_style_systems').upsert(
      {
        account_id: accountId,
        website_id: websiteId,
        tokens: normalised.tokens,
        moodboard: normalised.moodboard,
        locked: normalised.locked,
        style: normalised,
        created_by: user.id,
      },
      { onConflict: 'website_id' },
    );

    if (error) throw error;
    return { ok: true as const };
  }

  async suggestStyle(
    accountId: string,
    websiteId: string,
  ): Promise<WebsiteStyleSystem> {
    const user = await this.ensureSiteStudio(accountId);
    await this.verifyWebsite(accountId, websiteId);
    const brief = await this.loadBrief(accountId, websiteId);

    const { data: existingRow } = await this.client
      .from('website_style_systems')
      .select('style, tokens, moodboard, locked')
      .eq('website_id', websiteId)
      .eq('account_id', accountId)
      .maybeSingle();

    const existing = styleSystemFromDbRow(
      existingRow as {
        style?: unknown;
        tokens?: unknown;
        moodboard?: unknown;
        locked?: unknown;
      } | null,
    );

    if (existing.locked) {
      throw new Error(
        'Style tokens are locked. Unlock them before running Suggest style system.',
      );
    }

    const moodboard = existing.moodboard;

    const userPrompt = [
      `Brief:\n${briefContextBlock(brief)}`,
      moodboard.length
        ? `Moodboard references:\n${moodboard
            .map((ref) => {
              const palette = ref.extractedPalette?.length
                ? ` [palette: ${ref.extractedPalette.join(', ')}]`
                : '';
              return `- ${ref.url} — ${ref.note}${palette}`;
            })
            .join('\n')}`
        : null,
      'Propose the D1 StyleTokens JSON now (schemaVersion 1.0).',
    ]
      .filter(Boolean)
      .join('\n\n');

    const text = await callAI({
      feature: 'website_style_suggest',
      systemPrompt: STYLE_SUGGEST_SYSTEM,
      userPrompt,
      accountId,
      supabase: this.client,
    });

    const suggested = extractJson<Record<string, unknown>>(text);
    const tokens = normalizeWebsiteStyleTokens(suggested);

    const style: WebsiteStyleSystem = {
      tokens,
      moodboard,
      locked: false,
    };

    const { error } = await this.adminDb.from('website_style_systems').upsert(
      {
        account_id: accountId,
        website_id: websiteId,
        tokens: style.tokens,
        moodboard: style.moodboard,
        locked: false,
        style,
        created_by: user.id,
      },
      { onConflict: 'website_id' },
    );

    if (error) throw error;
    return style;
  }

  /* ---------------------------------------------------------------- */
  /* SEO pages (Prompt E1)                                             */
  /* ---------------------------------------------------------------- */

  async saveLlmsTxt(accountId: string, websiteId: string, llmsTxt: string) {
    await this.ensureSiteStudio(accountId);
    await this.verifyWebsite(accountId, websiteId);

    const trimmed = llmsTxt.trim();
    const value = trimmed.length ? trimmed : null;

    const { data: existing, error: findError } = await this.adminDb
      .from('website_briefs')
      .select('website_id')
      .eq('website_id', websiteId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (findError) throw findError;

    if (existing) {
      const { error } = await this.adminDb
        .from('website_briefs')
        .update({ llms_txt: value })
        .eq('website_id', websiteId)
        .eq('account_id', accountId);
      if (error) throw error;
    } else {
      const { error } = await this.adminDb.from('website_briefs').insert({
        account_id: accountId,
        website_id: websiteId,
        brief: emptyWebsiteBrief(),
        llms_txt: value,
      });
      if (error) throw error;
    }

    return { ok: true as const, llmsTxt: value };
  }

  async saveSeoPage(
    accountId: string,
    websiteId: string,
    pageId: string,
    seo: WebsiteSeoPageSeo,
    options?: { pageSlug?: string; status?: WebsiteSeoStatus },
  ) {
    await this.ensureSiteStudio(accountId);
    const website = await this.verifyWebsite(accountId, websiteId);
    const sitemap = migrateSitemapPages(website.sitemap);
    const page = sitemap.find((item) => item.id === pageId);
    const pageSlug = options?.pageSlug ?? page?.slug ?? '';
    const normalised = normalizeWebsiteSeoPageSeo(seo);
    const status = options?.status ?? 'draft';
    if (status === 'approved') {
      if (
        !normalised.keywords.primary.trim() ||
        !normalised.meta.title.trim()
      ) {
        throw new Error('Approve requires primary keyword and meta title.');
      }
    }
    const legacyFields = toLegacyFlatSeoFields(normalised);

    const { error } = await this.adminDb.from('website_seo_pages').upsert(
      {
        account_id: accountId,
        website_id: websiteId,
        page_id: pageId,
        page_slug: pageSlug || null,
        seo: normalised,
        status,
        fields: legacyFields,
      },
      { onConflict: 'website_id,page_id' },
    );

    if (error) throw error;
    return {
      ok: true as const,
      record: {
        pageId,
        pageSlug,
        seo: normalised,
        status,
      } satisfies WebsiteSeoPageRecord,
    };
  }

  async approveSeoPage(accountId: string, websiteId: string, pageId: string) {
    await this.ensureSiteStudio(accountId);
    await this.verifyWebsite(accountId, websiteId);

    const { data, error } = await this.adminDb
      .from('website_seo_pages')
      .select('page_id, page_slug, fields, seo, status')
      .eq('account_id', accountId)
      .eq('website_id', websiteId)
      .eq('page_id', pageId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Search plan not found — save a draft first.');

    const record = normalizeWebsiteSeoPageRecord(
      data,
      pageId,
      (data as { page_slug?: string }).page_slug ?? '',
    );
    if (!record.seo.keywords.primary || !record.seo.meta.title) {
      throw new Error('Approve requires primary keyword and meta title.');
    }

    return this.saveSeoPage(accountId, websiteId, pageId, record.seo, {
      pageSlug: record.pageSlug,
      status: 'approved',
    });
  }

  /** Preview-only search plan (Sonnet). Does not write. */
  async proposeSeoPage(
    accountId: string,
    websiteId: string,
    pageId: string,
  ): Promise<WebsiteSeoPageSeo> {
    await this.ensureSiteStudio(accountId);
    const website = await this.verifyWebsite(accountId, websiteId);
    const brief = await this.loadBrief(accountId, websiteId);

    const sitemap = migrateSitemapPages(website.sitemap);
    const page = sitemap.find((item) => item.id === pageId);
    if (!page) throw new Error('Sitemap page not found');

    const userPrompt = [
      `Brief:\n${briefContextBlock(brief)}`,
      `Full sitemap:\n${sitemapContextBlock(sitemap)}`,
      `Target page: ${page.title} (/${page.slug})${page.pageType ? `, type: ${page.pageType}` : ''}${page.description ? `\nDescription: ${page.description}` : ''}${page.seoIntent ? `\nIntent: ${page.seoIntent}` : ''}`,
      `Page sections:\n${page.sections
        .map((section) => `- ${section.title}: ${section.description}`)
        .join('\n')}`,
      'Produce the E1 search readiness JSON now.',
    ].join('\n\n');

    const text = await callAI({
      feature: 'website_seo_generate',
      systemPrompt: SEO_GENERATE_SYSTEM,
      userPrompt,
      accountId,
      supabase: this.client,
    });

    return normalizeWebsiteSeoPageSeo(extractJson(text));
  }

  /** Preview-only AEO answer blocks (Haiku). Does not write. */
  async draftSeoAnswerBlocks(
    accountId: string,
    websiteId: string,
    pageId: string,
  ): Promise<WebsiteSeoPageSeo['aeo']['answerBlocks']> {
    await this.ensureSiteStudio(accountId);
    const website = await this.verifyWebsite(accountId, websiteId);
    const brief = await this.loadBrief(accountId, websiteId);
    const sitemap = migrateSitemapPages(website.sitemap);
    const page = sitemap.find((item) => item.id === pageId);
    if (!page) throw new Error('Sitemap page not found');

    const userPrompt = [
      `Brief:\n${briefContextBlock(brief)}`,
      `Page: ${page.title} (/${page.slug}) — ${page.description || page.seoIntent || 'no description'}`,
      'Draft answer blocks JSON now.',
    ].join('\n\n');

    const text = await callAI({
      feature: 'website_seo_answer_blocks',
      systemPrompt: SEO_ANSWER_BLOCKS_SYSTEM,
      userPrompt,
      accountId,
      supabase: this.client,
    });

    const parsed = extractJson<{ answerBlocks?: unknown }>(text);
    return normalizeWebsiteSeoPageSeo({
      aeo: { answerBlocks: parsed.answerBlocks ?? [] },
    }).aeo.answerBlocks;
  }

  /** @deprecated Prefer proposeSeoPage + saveSeoPage (preview-then-apply). */
  async generateSeoPage(
    accountId: string,
    websiteId: string,
    pageId: string,
  ): Promise<WebsiteSeoPageSeo> {
    const seo = await this.proposeSeoPage(accountId, websiteId, pageId);
    await this.saveSeoPage(accountId, websiteId, pageId, seo, {
      status: 'draft',
    });
    return seo;
  }

  /* ---------------------------------------------------------------- */
  /* Sharing                                                           */
  /* ---------------------------------------------------------------- */

  async createShare(
    accountId: string,
    websiteId: string,
    scope: WebsiteShareScope,
    expiresAt: string | null = null,
  ): Promise<WebsiteShareLink & { url: string }> {
    const user = await this.ensureSiteStudio(accountId);
    await this.verifyWebsite(accountId, websiteId);

    const token = generateShareToken();
    let resolvedExpiresAt: string | null = null;
    if (expiresAt) {
      const parsed = new Date(expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('Invalid expiry date');
      }
      if (parsed.getTime() <= Date.now()) {
        throw new Error('Expiry must be in the future');
      }
      resolvedExpiresAt = parsed.toISOString();
    }

    const { data, error } = await this.adminDb
      .from('website_shares')
      .insert({
        account_id: accountId,
        website_id: websiteId,
        token,
        scope,
        expires_at: resolvedExpiresAt,
        created_by: user.id,
      })
      .select('id, token, scope, expires_at, created_at')
      .single();

    if (error) throw error;

    const row = data as {
      id: string;
      token: string;
      scope: string;
      expires_at: string | null;
      created_at: string;
    };

    return {
      id: row.id,
      token: row.token,
      scope: row.scope as WebsiteShareScope,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      url: websiteShareUrl(row.token),
    };
  }

  /**
   * Reuse an active wireframes|design|full share, or mint a wireframes-scope share
   * for Figma html.to.design / PNG capture URLs.
   */
  async ensureWireframesShareForFigma(
    accountId: string,
    websiteId: string,
  ): Promise<WebsiteShareLink & { url: string }> {
    await this.ensureSiteStudio(accountId);
    await this.verifyWebsite(accountId, websiteId);

    const { data, error } = await this.adminDb
      .from('website_shares')
      .select('id, token, scope, expires_at, created_at')
      .eq('account_id', accountId)
      .eq('website_id', websiteId)
      .is('revoked_at', null)
      .in('scope', ['wireframes', 'design', 'full'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const now = Date.now();
    const active = (
      (data ?? []) as Array<{
        id: string;
        token: string;
        scope: string;
        expires_at: string | null;
        created_at: string;
      }>
    ).find((row) => {
      if (!row.expires_at) return true;
      return new Date(row.expires_at).getTime() > now;
    });

    if (active) {
      return {
        id: active.id,
        token: active.token,
        scope: active.scope as WebsiteShareScope,
        expiresAt: active.expires_at,
        createdAt: active.created_at,
        url: websiteShareUrl(active.token),
      };
    }

    return this.createShare(accountId, websiteId, 'wireframes', null);
  }

  async revokeShare(accountId: string, websiteId: string, shareId: string) {
    await this.ensureSiteStudio(accountId);

    const { error } = await this.adminDb
      .from('website_shares')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', shareId)
      .eq('website_id', websiteId)
      .eq('account_id', accountId);

    if (error) throw error;
    return { ok: true as const };
  }

  async setPortalScope(
    accountId: string,
    websiteId: string,
    scope: WebsitePortalShareScope,
  ) {
    await this.ensureSiteStudio(accountId);
    await this.verifyWebsite(accountId, websiteId);

    const { error } = await this.adminDb
      .from('websites')
      .update({
        portal_share_scope: scope,
        updated_at: new Date().toISOString(),
      })
      .eq('id', websiteId)
      .eq('business_id', accountId);

    if (error) throw error;
    return { ok: true as const };
  }
}

/* -------------------------------------------------------------------- */
/* Public (token) access — used by /portal/websites/[token]              */
/* -------------------------------------------------------------------- */

export type PublicWebsiteShare = {
  scope: WebsiteShareScope;
  websiteName: string;
  accountId: string;
  websiteId: string;
  sitemap: WebsiteSitemapPage[];
  wireframes: WebsiteWireframePage[];
  style: WebsiteStyleSystem | null;
  brief: WebsiteBrief | null;
};

export type ResolvedWebsiteShare = {
  websiteId: string;
  accountId: string;
  scope: WebsiteShareScope;
};

function shareScopeAllowsWireframes(scope: WebsiteShareScope) {
  return scope === 'wireframes' || scope === 'design' || scope === 'full';
}

function shareScopeAllowsStyle(scope: WebsiteShareScope) {
  return scope === 'design' || scope === 'full';
}

function shareScopeAllowsBrief(scope: WebsiteShareScope) {
  return scope === 'full';
}

export { shareScopeAllowsWireframes };

/** Validate an active (non-revoked, non-expired) share token row. */
export async function resolveActiveWebsiteShare(
  token: string,
): Promise<ResolvedWebsiteShare | null> {
  const admin = getSupabaseServerAdminClient() as SupabaseClient;

  const { data: share, error } = await admin
    .from('website_shares')
    .select('website_id, account_id, scope, expires_at, revoked_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !share) return null;

  const shareRow = share as {
    website_id: string;
    account_id: string;
    scope: string;
    expires_at: string | null;
    revoked_at: string | null;
  };

  if (shareRow.revoked_at) return null;
  if (
    shareRow.expires_at &&
    new Date(shareRow.expires_at).getTime() < Date.now()
  ) {
    return null;
  }

  return {
    websiteId: shareRow.website_id,
    accountId: shareRow.account_id,
    scope: shareRow.scope as WebsiteShareScope,
  };
}

export async function getWebsiteShareByToken(
  token: string,
): Promise<PublicWebsiteShare | null> {
  const shareRow = await resolveActiveWebsiteShare(token);
  if (!shareRow) return null;

  const admin = getSupabaseServerAdminClient() as SupabaseClient;
  const { scope } = shareRow;
  const loadWireframes = shareScopeAllowsWireframes(scope);
  const loadStyle = shareScopeAllowsStyle(scope);
  const loadBrief = shareScopeAllowsBrief(scope);

  const [websiteRes, briefRes, styleRes] = await Promise.all([
    admin
      .from('websites')
      .select('id, name, sitemap, wireframes')
      .eq('id', shareRow.websiteId)
      .maybeSingle(),
    loadBrief
      ? admin
          .from('website_briefs')
          .select('brief')
          .eq('website_id', shareRow.websiteId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    loadStyle
      ? admin
          .from('website_style_systems')
          .select('style, tokens, moodboard, locked')
          .eq('website_id', shareRow.websiteId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const website = websiteRes.data as {
    id: string;
    name?: string | null;
    sitemap?: unknown;
    wireframes?: unknown;
  } | null;
  if (!website) return null;

  let brief: WebsiteBrief | null = null;
  if (
    loadBrief &&
    briefRes.data?.brief &&
    typeof briefRes.data.brief === 'object'
  ) {
    brief = normalizeWebsiteBrief(briefRes.data.brief);
  }

  let style: WebsiteStyleSystem | null = null;
  if (loadStyle) {
    const styleData = styleRes.data as {
      style?: unknown;
      tokens?: unknown;
      moodboard?: unknown;
      locked?: unknown;
    } | null;
    if (styleData) {
      style = styleSystemFromDbRow(styleData);
    }
  }

  return {
    scope,
    websiteName: website.name ?? 'Website',
    accountId: shareRow.accountId,
    websiteId: website.id,
    sitemap: migrateSitemapPages(website.sitemap),
    // Scope strip: never return wireframes for sitemap-only shares.
    wireframes:
      loadWireframes && Array.isArray(website.wireframes)
        ? wireframesForClientShare(website.wireframes as WebsiteWireframePage[])
        : [],
    style,
    brief,
  };
}

/** @deprecated Prefer website-approvals.service — kept for any residual imports. */
export async function setShareApprovalByToken(input: {
  token: string;
  pageId: string;
  status: 'approved' | 'blocked';
  note?: string;
}): Promise<{ ok: true }> {
  const { setShareApprovalByToken: apply } =
    await import('./website-approvals.service');
  return apply({
    token: input.token,
    targetType: 'page',
    targetId: input.pageId,
    pageId: input.pageId,
    status: input.status,
    note: input.note,
  });
}

/** Client comment on a wireframe section from a public share link. */
export async function setShareSectionCommentByToken(input: {
  token: string;
  pageId: string;
  sectionId: string;
  comment: string;
}): Promise<{ ok: true }> {
  const share = await resolveActiveWebsiteShare(input.token);
  if (!share) throw new Error('Share link not found or expired');
  if (!shareScopeAllowsWireframes(share.scope)) {
    throw new Error('This share link does not include wireframes');
  }

  const admin = getSupabaseServerAdminClient();
  const { data: website, error: loadError } = await admin
    .from('websites')
    .select('wireframes')
    .eq('id', share.websiteId)
    .maybeSingle();

  if (loadError) throw loadError;
  if (!website) throw new Error('Website not found');

  const wireframes = Array.isArray(website.wireframes)
    ? (website.wireframes as WebsiteWireframePage[])
    : [];
  const comment = input.comment.trim().slice(0, 2000);

  let found = false;
  const nextWireframes = wireframes.map((page) => {
    if (page.pageId !== input.pageId) return page;
    return {
      ...page,
      sections: page.sections.map((section) => {
        if (section.id !== input.sectionId) return section;
        found = true;
        return {
          ...section,
          clientComment: comment || undefined,
        };
      }),
    };
  });

  if (!found) throw new Error('Section not found');

  const { error } = await admin
    .from('websites')
    .update({
      wireframes: nextWireframes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', share.websiteId);

  if (error) throw error;
  return { ok: true };
}
