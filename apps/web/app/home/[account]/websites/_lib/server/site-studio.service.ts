import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { randomBytes } from 'crypto';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { callAI } from '~/lib/ai/router';
import { canUseAddon } from '~/lib/billing/entitlements';
import {
  type SiteStudioBundle,
  type WebsiteBrief,
  type WebsitePlanningStatus,
  type WebsitePortalShareScope,
  type WebsiteSeoPageFields,
  type WebsiteShareLink,
  type WebsiteShareScope,
  type WebsiteSitemapPage,
  type WebsiteSitemapSection,
  type WebsiteStyleSystem,
  type WebsiteWireframePage,
  type WebsiteWireframeSection,
  createPlanningId,
  emptySiteStudioBundle,
  emptyWebsiteBrief,
  emptyWebsiteSeoPageFields,
  emptyWebsiteStyleSystem,
  slugifyPageTitle,
} from '~/lib/websites/planning-types';
import { findSectionLibraryEntry } from '~/lib/websites/section-library';
import { ensureWireframeCopy } from '~/lib/websites/wireframe-copy';

import {
  isMissingColumnError,
  isMissingRelationError,
  logMissingRelation,
} from '../../../_lib/server/supabase-errors';
import {
  BRIEF_SUGGEST_SYSTEM,
  SEO_GENERATE_SYSTEM,
  SITEMAP_GENERATE_SYSTEM,
  STYLE_SUGGEST_SYSTEM,
  WIREFRAME_GENERATE_SYSTEM,
  briefContextBlock,
  extractJson,
  sitemapContextBlock,
} from './site-studio-ai';

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

/** Fetch a URL and reduce to plain text for AI context (best effort). */
async function fetchUrlText(url: string): Promise<string> {
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(normalized, {
      signal: controller.signal,
      headers: { 'user-agent': 'OzerSiteStudio/1.0 (+https://ozer.so)' },
    });
    clearTimeout(timer);

    if (!response.ok) return '';

    const html = await response.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12_000);
  } catch {
    return '';
  }
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
    const { data, error } = await this.client
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    const role = data?.account_role;
    if (role !== 'owner' && role !== 'admin') {
      throw new Error('Only account owners and admins can perform this action');
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

  async hasSiteStudioAccess(accountId: string): Promise<boolean> {
    const { data: user } = await requireUser(this.client);
    if (!user) return false;
    return canUseAddon(this.client, user.id, accountId, 'addon_site_studio');
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
  ): Promise<SiteStudioBundle> {
    await this.ensureCanView(accountId);
    const enabled = await this.hasSiteStudioAccess(accountId);

    const bundle = emptySiteStudioBundle();
    bundle.enabled = enabled;

    const [briefRes, styleRes, seoRes, sharesRes, websiteRes] =
      await Promise.all([
        this.client
          .from('website_briefs')
          .select('brief')
          .eq('website_id', websiteId)
          .eq('account_id', accountId)
          .maybeSingle(),
        this.client
          .from('website_style_systems')
          .select('style')
          .eq('website_id', websiteId)
          .eq('account_id', accountId)
          .maybeSingle(),
        this.client
          .from('website_seo_pages')
          .select('page_id, fields')
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

    for (const res of [briefRes, styleRes, seoRes, sharesRes]) {
      if (res.error && isMissingRelationError(res.error)) {
        logMissingRelation('site_studio.getBundle', res.error);
        return bundle;
      }
    }

    if (briefRes.data?.brief && typeof briefRes.data.brief === 'object') {
      bundle.brief = {
        ...emptyWebsiteBrief(),
        ...(briefRes.data.brief as Partial<WebsiteBrief>),
      };
    }

    if (styleRes.data?.style && typeof styleRes.data.style === 'object') {
      const empty = emptyWebsiteStyleSystem();
      const stored = styleRes.data.style as Partial<WebsiteStyleSystem>;
      bundle.style = {
        tokens: { ...empty.tokens, ...(stored.tokens ?? {}) },
        moodboard: stored.moodboard ?? [],
        locked: Boolean(stored.locked),
      };
    }

    for (const row of (seoRes.data ?? []) as Array<{
      page_id: string;
      fields: unknown;
    }>) {
      bundle.seoPages[row.page_id] = {
        ...emptyWebsiteSeoPageFields(),
        ...((row.fields ?? {}) as Partial<WebsiteSeoPageFields>),
      };
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

    return bundle;
  }

  /* ---------------------------------------------------------------- */
  /* Brief                                                             */
  /* ---------------------------------------------------------------- */

  async saveBrief(accountId: string, websiteId: string, brief: WebsiteBrief) {
    const user = await this.ensureSiteStudio(accountId);
    await this.verifyWebsite(accountId, websiteId);

    const { error } = await this.adminDb.from('website_briefs').upsert(
      {
        account_id: accountId,
        website_id: websiteId,
        brief,
        created_by: user.id,
      },
      { onConflict: 'website_id' },
    );

    if (error) throw error;
    return { ok: true as const };
  }

  private async loadBrief(
    accountId: string,
    websiteId: string,
  ): Promise<WebsiteBrief | null> {
    const { data } = await this.client
      .from('website_briefs')
      .select('brief')
      .eq('website_id', websiteId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (!data?.brief || typeof data.brief !== 'object') return null;
    return { ...emptyWebsiteBrief(), ...(data.brief as Partial<WebsiteBrief>) };
  }

  async suggestBrief(
    accountId: string,
    websiteId: string,
    input: { notes?: string; websiteUrl?: string },
  ): Promise<WebsiteBrief> {
    const user = await this.ensureSiteStudio(accountId);
    const website = await this.verifyWebsite(accountId, websiteId);

    const urlText = input.websiteUrl
      ? await fetchUrlText(input.websiteUrl)
      : '';

    let clientOrgName: string | null = null;
    if (website.client_org_id) {
      const { data } = await this.client
        .from('client_orgs')
        .select('name')
        .eq('id', website.client_org_id)
        .maybeSingle();
      clientOrgName = (data as { name?: string } | null)?.name ?? null;
    }

    const userPrompt = [
      `Website record name: ${website.name ?? 'Untitled'}`,
      clientOrgName ? `Client organisation: ${clientOrgName}` : null,
      website.domain ? `Domain: ${website.domain}` : null,
      input.notes ? `Discovery notes:\n${input.notes}` : null,
      urlText ? `Extracted text from ${input.websiteUrl}:\n${urlText}` : null,
      'Draft the structured brief JSON now.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const text = await callAI({
      feature: 'website_brief_suggest',
      systemPrompt: BRIEF_SUGGEST_SYSTEM,
      userPrompt,
      accountId,
      supabase: this.client,
    });

    const suggested = extractJson<Partial<WebsiteBrief>>(text);
    const brief: WebsiteBrief = {
      ...emptyWebsiteBrief(),
      ...suggested,
      references: Array.isArray(suggested.references)
        ? suggested.references
            .filter((ref) => ref && typeof ref.url === 'string')
            .slice(0, 10)
            .map((ref) => ({
              url: String(ref.url).slice(0, 500),
              why: String(ref.why ?? '').slice(0, 1000),
            }))
        : [],
      targetStack: ['webflow', 'astro', 'next', 'undecided'].includes(
        String(suggested.targetStack),
      )
        ? (suggested.targetStack as WebsiteBrief['targetStack'])
        : 'undecided',
      cmsNeeded: Boolean(suggested.cmsNeeded),
    };

    const { error } = await this.adminDb.from('website_briefs').upsert(
      {
        account_id: accountId,
        website_id: websiteId,
        brief,
        ai_provenance: {
          feature: 'website_brief_suggest',
          sourceUrl: input.websiteUrl ?? null,
          generatedAt: new Date().toISOString(),
        },
        created_by: user.id,
      },
      { onConflict: 'website_id' },
    );

    if (error) throw error;
    return brief;
  }

  /* ---------------------------------------------------------------- */
  /* AI sitemap                                                        */
  /* ---------------------------------------------------------------- */

  async generateSitemap(
    accountId: string,
    websiteId: string,
    mode: 'replace' | 'add-missing-seo-pages',
  ): Promise<WebsiteSitemapPage[]> {
    await this.ensureSiteStudio(accountId);
    const website = await this.verifyWebsite(accountId, websiteId);
    const brief = await this.loadBrief(accountId, websiteId);

    const currentSitemap = Array.isArray(website.sitemap)
      ? (website.sitemap as WebsiteSitemapPage[])
      : [];

    const userPrompt = [
      `Brief:\n${briefContextBlock(brief)}`,
      mode === 'add-missing-seo-pages'
        ? `Current sitemap:\n${sitemapContextBlock(currentSitemap)}\n\nPropose ONLY the missing pages this site needs for SEO/local/answer-engine coverage (service pages, location pages, FAQ, comparison, legal). Return only new pages, not existing ones.`
        : 'Propose the full sitemap for this site.',
    ].join('\n\n');

    const text = await callAI({
      feature: 'website_sitemap_generate',
      systemPrompt: SITEMAP_GENERATE_SYSTEM,
      userPrompt,
      accountId,
      supabase: this.client,
    });

    type RawSection = {
      title?: string;
      description?: string;
      sectionType?: string;
      componentKey?: string | null;
    };
    type RawPage = {
      title?: string;
      slug?: string;
      description?: string;
      pageType?: string;
      seoIntent?: string;
      parentSlug?: string | null;
      sections?: RawSection[];
    };

    let rawPages: RawPage[];
    try {
      rawPages = extractJson<RawPage[]>(text);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to parse AI sitemap response',
      );
    }
    if (!Array.isArray(rawPages) || rawPages.length === 0) {
      throw new Error('AI did not return any pages');
    }

    const sectionTypes = new Set([
      'nav',
      'hero',
      'proof',
      'conversion',
      'content',
      'footer',
    ]);
    const pageTypes = new Set([
      'home',
      'service',
      'location',
      'about',
      'contact',
      'blog-index',
      'blog-post',
      'legal',
      'landing',
      'other',
    ]);

    // Shared component sections keep one canonical copy per componentKey.
    const componentSections = new Map<string, WebsiteSitemapSection>();

    const newPages: WebsiteSitemapPage[] = rawPages
      .filter((page) => page && typeof page.title === 'string')
      .slice(0, 30)
      .map((page) => {
        const sections: WebsiteSitemapSection[] = (page.sections ?? [])
          .filter((section) => section && typeof section.title === 'string')
          .slice(0, 20)
          .map((section) => {
            const componentKey =
              typeof section.componentKey === 'string' &&
              section.componentKey.trim()
                ? section.componentKey.trim()
                : null;

            if (componentKey) {
              const canonical = componentSections.get(componentKey);
              if (canonical) {
                return {
                  ...canonical,
                  id: createPlanningId(),
                };
              }
            }

            const mapped: WebsiteSitemapSection = {
              id: createPlanningId(),
              title: String(section.title).slice(0, 200),
              description: String(section.description ?? '').slice(0, 5000),
              sectionType: sectionTypes.has(String(section.sectionType))
                ? (section.sectionType as WebsiteSitemapSection['sectionType'])
                : 'other',
              componentKey,
              status: 'draft' as WebsitePlanningStatus,
            };

            if (componentKey) componentSections.set(componentKey, mapped);
            return mapped;
          });

        return {
          id: createPlanningId(),
          title: String(page.title).slice(0, 200),
          slug:
            slugifyPageTitle(String(page.slug ?? page.title)) ||
            slugifyPageTitle(String(page.title)),
          sections,
          description: String(page.description ?? '').slice(0, 2000),
          pageType: pageTypes.has(String(page.pageType))
            ? (page.pageType as WebsiteSitemapPage['pageType'])
            : 'other',
          status: 'draft' as WebsitePlanningStatus,
          parentId: null,
          seoIntent: String(page.seoIntent ?? '').slice(0, 500),
          _parentSlug:
            typeof page.parentSlug === 'string' ? page.parentSlug : null,
        } as WebsiteSitemapPage & { _parentSlug: string | null };
      });

    // Resolve parentSlug → parentId (within new pages, then existing pages).
    const allForParents =
      mode === 'add-missing-seo-pages'
        ? [...currentSitemap, ...newPages]
        : newPages;
    const bySlug = new Map(allForParents.map((page) => [page.slug, page.id]));

    for (const page of newPages as Array<
      WebsiteSitemapPage & { _parentSlug?: string | null }
    >) {
      if (page._parentSlug) {
        const parentId = bySlug.get(slugifyPageTitle(page._parentSlug));
        if (parentId && parentId !== page.id) page.parentId = parentId;
      }
      delete page._parentSlug;
    }

    const nextSitemap =
      mode === 'add-missing-seo-pages'
        ? [
            ...currentSitemap,
            ...newPages.filter(
              (page) =>
                !currentSitemap.some((existing) => existing.slug === page.slug),
            ),
          ]
        : newPages;

    const { error } = await this.adminDb
      .from('websites')
      .update({ sitemap: nextSitemap, updated_at: new Date().toISOString() })
      .eq('id', websiteId)
      .eq('business_id', accountId);

    if (error) throw error;
    return nextSitemap;
  }

  /* ---------------------------------------------------------------- */
  /* AI wireframes                                                     */
  /* ---------------------------------------------------------------- */

  async generateWireframesForPage(
    accountId: string,
    websiteId: string,
    pageId: string,
  ): Promise<WebsiteWireframePage[]> {
    await this.ensureSiteStudio(accountId);
    const website = await this.verifyWebsite(accountId, websiteId);
    const brief = await this.loadBrief(accountId, websiteId);

    const sitemap = Array.isArray(website.sitemap)
      ? (website.sitemap as WebsiteSitemapPage[])
      : [];
    const page = sitemap.find((item) => item.id === pageId);
    if (!page) throw new Error('Sitemap page not found');
    if (page.sections.length === 0) {
      throw new Error('Add sections to this page in the sitemap first');
    }

    const userPrompt = [
      `Brief:\n${briefContextBlock(brief)}`,
      `Page: ${page.title} (/${page.slug})${page.seoIntent ? ` — intent: ${page.seoIntent}` : ''}`,
      `Sitemap sections (in order):\n${page.sections
        .map((section) => `- ${section.title}: ${section.description}`)
        .join('\n')}`,
      'Produce the wireframe spec JSON now.',
    ].join('\n\n');

    const text = await callAI({
      feature: 'website_wireframe_generate',
      systemPrompt: WIREFRAME_GENERATE_SYSTEM,
      userPrompt,
      accountId,
      supabase: this.client,
    });

    type RawWireframeSection = {
      sitemapSectionTitle?: string;
      title?: string;
      libraryKey?: string;
      copyOutline?: string;
      contentNotes?: string;
      copy?: {
        slots?: Record<string, string>;
        items?: Array<{ slots?: Record<string, string> }>;
      };
    };

    const rawSections = extractJson<RawWireframeSection[]>(text);
    if (!Array.isArray(rawSections)) {
      throw new Error('AI did not return wireframe sections');
    }

    const sections: WebsiteWireframeSection[] = page.sections.map(
      (sitemapSection, index) => {
        const match =
          rawSections.find(
            (raw) =>
              raw.sitemapSectionTitle?.trim().toLowerCase() ===
              sitemapSection.title.trim().toLowerCase(),
          ) ?? rawSections[index];

        const library = findSectionLibraryEntry(match?.libraryKey ?? null);

        const section: WebsiteWireframeSection = {
          id: createPlanningId(),
          sitemapSectionId: sitemapSection.id,
          title: String(match?.title ?? sitemapSection.title).slice(0, 200),
          layout: library?.layout ?? 'full',
          libraryKey: library?.key ?? null,
          copyOutline: String(match?.copyOutline ?? '').slice(0, 10000),
          contentNotes: String(
            match?.contentNotes ?? sitemapSection.description,
          ).slice(0, 10000),
        };

        const seeded = ensureWireframeCopy(section);
        const aiSlots = match?.copy?.slots;
        if (aiSlots && typeof aiSlots === 'object') {
          for (const [key, value] of Object.entries(aiSlots)) {
            if (typeof value === 'string' && value.trim()) {
              seeded.slots[key] = value.slice(0, 10000);
            }
          }
        }
        const aiItems = match?.copy?.items;
        if (Array.isArray(aiItems) && aiItems.length > 0 && seeded.items) {
          seeded.items = seeded.items.map((item, itemIndex) => {
            const rawItem = aiItems[itemIndex];
            if (!rawItem?.slots) return item;
            const nextSlots = { ...item.slots };
            for (const [key, value] of Object.entries(rawItem.slots)) {
              if (typeof value === 'string' && value.trim()) {
                nextSlots[key] = value.slice(0, 10000);
              }
            }
            return { ...item, slots: nextSlots };
          });
        }

        return {
          ...section,
          copy: seeded,
        };
      },
    );

    const existing = Array.isArray(website.wireframes)
      ? (website.wireframes as WebsiteWireframePage[])
      : [];

    const nextPage: WebsiteWireframePage = {
      id:
        existing.find((item) => item.pageId === pageId)?.id ??
        createPlanningId(),
      pageId,
      title: page.title,
      sections,
    };

    const nextWireframes = existing.some((item) => item.pageId === pageId)
      ? existing.map((item) => (item.pageId === pageId ? nextPage : item))
      : [...existing, nextPage];

    const { error } = await this.adminDb
      .from('websites')
      .update({
        wireframes: nextWireframes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', websiteId)
      .eq('business_id', accountId);

    if (error) throw error;
    return nextWireframes;
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

    const { error } = await this.adminDb.from('website_style_systems').upsert(
      {
        account_id: accountId,
        website_id: websiteId,
        style,
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
      .select('style')
      .eq('website_id', websiteId)
      .eq('account_id', accountId)
      .maybeSingle();

    const existing = (existingRow?.style ?? null) as WebsiteStyleSystem | null;
    const moodboard = existing?.moodboard ?? [];

    const userPrompt = [
      `Brief:\n${briefContextBlock(brief)}`,
      moodboard.length
        ? `Moodboard references:\n${moodboard
            .map((ref) => `- ${ref.url} — ${ref.note}`)
            .join('\n')}`
        : null,
      'Propose the style system JSON now.',
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
    const empty = emptyWebsiteStyleSystem();

    const pick = (key: string, fallback: string) => {
      const value = suggested[key];
      return typeof value === 'string' && value.trim()
        ? value.trim().slice(0, 100)
        : fallback;
    };

    const style: WebsiteStyleSystem = {
      tokens: {
        canvas: pick('canvas', empty.tokens.canvas),
        atmosphere: pick('atmosphere', empty.tokens.atmosphere),
        accent: pick('accent', empty.tokens.accent),
        contrast: pick('contrast', empty.tokens.contrast),
        secondary: pick('secondary', empty.tokens.secondary),
        headingFont: pick('headingFont', ''),
        bodyFont: pick('bodyFont', ''),
        typeScale: ['compact', 'regular', 'display'].includes(
          String(suggested.typeScale),
        )
          ? (suggested.typeScale as 'compact' | 'regular' | 'display')
          : 'regular',
        radius: ['sharp', 'soft', 'round'].includes(String(suggested.radius))
          ? (suggested.radius as 'sharp' | 'soft' | 'round')
          : 'soft',
        spacingDensity: ['tight', 'regular', 'airy'].includes(
          String(suggested.spacingDensity),
        )
          ? (suggested.spacingDensity as 'tight' | 'regular' | 'airy')
          : 'regular',
        photographyDirection: String(
          suggested.photographyDirection ?? '',
        ).slice(0, 2000),
      },
      moodboard,
      locked: false,
    };

    const { error } = await this.adminDb.from('website_style_systems').upsert(
      {
        account_id: accountId,
        website_id: websiteId,
        style,
        created_by: user.id,
      },
      { onConflict: 'website_id' },
    );

    if (error) throw error;
    return style;
  }

  /* ---------------------------------------------------------------- */
  /* SEO pages                                                         */
  /* ---------------------------------------------------------------- */

  async saveSeoPage(
    accountId: string,
    websiteId: string,
    pageId: string,
    fields: WebsiteSeoPageFields,
  ) {
    await this.ensureSiteStudio(accountId);
    await this.verifyWebsite(accountId, websiteId);

    const { error } = await this.adminDb.from('website_seo_pages').upsert(
      {
        account_id: accountId,
        website_id: websiteId,
        page_id: pageId,
        fields,
      },
      { onConflict: 'website_id,page_id' },
    );

    if (error) throw error;
    return { ok: true as const };
  }

  async generateSeoPage(
    accountId: string,
    websiteId: string,
    pageId: string,
  ): Promise<WebsiteSeoPageFields> {
    await this.ensureSiteStudio(accountId);
    const website = await this.verifyWebsite(accountId, websiteId);
    const brief = await this.loadBrief(accountId, websiteId);

    const sitemap = Array.isArray(website.sitemap)
      ? (website.sitemap as WebsiteSitemapPage[])
      : [];
    const page = sitemap.find((item) => item.id === pageId);
    if (!page) throw new Error('Sitemap page not found');

    const userPrompt = [
      `Brief:\n${briefContextBlock(brief)}`,
      `Full sitemap:\n${sitemapContextBlock(sitemap)}`,
      `Target page: ${page.title} (/${page.slug})${page.pageType ? `, type: ${page.pageType}` : ''}${page.seoIntent ? `, intent: ${page.seoIntent}` : ''}`,
      `Page sections:\n${page.sections
        .map((section) => `- ${section.title}: ${section.description}`)
        .join('\n')}`,
      'Produce the search readiness JSON now.',
    ].join('\n\n');

    const text = await callAI({
      feature: 'website_seo_generate',
      systemPrompt: SEO_GENERATE_SYSTEM,
      userPrompt,
      accountId,
      supabase: this.client,
    });

    const suggested = extractJson<Partial<WebsiteSeoPageFields>>(text);
    const fields: WebsiteSeoPageFields = {
      ...emptyWebsiteSeoPageFields(),
      ...suggested,
      schemaTypes: Array.isArray(suggested.schemaTypes)
        ? suggested.schemaTypes
            .map((type) => String(type).slice(0, 100))
            .slice(0, 10)
        : [],
      answerBlocks: Array.isArray(suggested.answerBlocks)
        ? suggested.answerBlocks
            .filter((block) => block && typeof block.question === 'string')
            .slice(0, 20)
            .map((block) => ({
              question: String(block.question).slice(0, 500),
              answer: String(block.answer ?? '').slice(0, 5000),
            }))
        : [],
    };

    await this.saveSeoPageBypass(accountId, websiteId, pageId, fields);
    return fields;
  }

  private async saveSeoPageBypass(
    accountId: string,
    websiteId: string,
    pageId: string,
    fields: WebsiteSeoPageFields,
  ) {
    const { error } = await this.adminDb.from('website_seo_pages').upsert(
      {
        account_id: accountId,
        website_id: websiteId,
        page_id: pageId,
        fields,
      },
      { onConflict: 'website_id,page_id' },
    );

    if (error) throw error;
  }

  /* ---------------------------------------------------------------- */
  /* Sharing                                                           */
  /* ---------------------------------------------------------------- */

  async createShare(
    accountId: string,
    websiteId: string,
    scope: WebsiteShareScope,
  ): Promise<WebsiteShareLink & { url: string }> {
    const user = await this.ensureSiteStudio(accountId);
    await this.verifyWebsite(accountId, websiteId);

    const token = generateShareToken();

    const { data, error } = await this.adminDb
      .from('website_shares')
      .insert({
        account_id: accountId,
        website_id: websiteId,
        token,
        scope,
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

export async function getWebsiteShareByToken(
  token: string,
): Promise<PublicWebsiteShare | null> {
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

  const scope = shareRow.scope as WebsiteShareScope;
  const loadStyle = scope === 'design' || scope === 'full';

  // Brief is always loaded for client review (alongside sitemap/wireframes).
  const [websiteRes, briefRes, styleRes] = await Promise.all([
    admin
      .from('websites')
      .select('id, name, sitemap, wireframes')
      .eq('id', shareRow.website_id)
      .maybeSingle(),
    admin
      .from('website_briefs')
      .select('brief')
      .eq('website_id', shareRow.website_id)
      .maybeSingle(),
    loadStyle
      ? admin
          .from('website_style_systems')
          .select('style')
          .eq('website_id', shareRow.website_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const website = websiteRes.data;
  if (!website) return null;

  let brief: WebsiteBrief | null = null;
  if (briefRes.data?.brief && typeof briefRes.data.brief === 'object') {
    brief = {
      ...emptyWebsiteBrief(),
      ...(briefRes.data.brief as Partial<WebsiteBrief>),
    };
  }

  let style: WebsiteStyleSystem | null = null;
  if (loadStyle) {
    const styleData = styleRes.data as { style?: unknown } | null;
    if (styleData?.style && typeof styleData.style === 'object') {
      const empty = emptyWebsiteStyleSystem();
      const stored = styleData.style as Partial<WebsiteStyleSystem>;
      style = {
        tokens: { ...empty.tokens, ...(stored.tokens ?? {}) },
        moodboard: stored.moodboard ?? [],
        locked: Boolean(stored.locked),
      };
    }
  }

  const websiteRow = website as {
    id: string;
    name?: string | null;
    sitemap?: unknown;
    wireframes?: unknown;
  };

  return {
    scope,
    websiteName: websiteRow.name ?? 'Website',
    accountId: shareRow.account_id,
    websiteId: websiteRow.id,
    sitemap: Array.isArray(websiteRow.sitemap)
      ? (websiteRow.sitemap as WebsiteSitemapPage[])
      : [],
    wireframes: Array.isArray(websiteRow.wireframes)
      ? (websiteRow.wireframes as WebsiteWireframePage[])
      : [],
    style,
    brief,
  };
}

/** Client approval from a public share link: approve / request changes per page. */
export async function setShareApprovalByToken(input: {
  token: string;
  pageId: string;
  status: 'approved' | 'blocked';
  note?: string;
}): Promise<{ ok: true }> {
  const share = await getWebsiteShareByToken(input.token);
  if (!share) throw new Error('Share link not found or expired');

  const admin = getSupabaseServerAdminClient();

  const nextSitemap = share.sitemap.map((page) =>
    page.id === input.pageId
      ? {
          ...page,
          status: input.status,
          approvalNote: input.note?.slice(0, 2000) ?? page.approvalNote,
        }
      : page,
  );

  if (!nextSitemap.some((page) => page.id === input.pageId)) {
    throw new Error('Page not found');
  }

  const { error } = await admin
    .from('websites')
    .update({ sitemap: nextSitemap, updated_at: new Date().toISOString() })
    .eq('id', share.websiteId);

  if (error) throw error;
  return { ok: true };
}
