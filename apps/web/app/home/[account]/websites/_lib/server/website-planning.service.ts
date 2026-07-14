import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type {
  WebsiteContentDoc,
  WebsiteSitemapDocument,
  WebsiteSitemapPage,
  WebsiteSitemapSymbol,
  WebsiteWireframePage,
} from '~/lib/websites/planning-types';
import { migrateSitemapDocument } from '~/lib/websites/sitemap-document';
import { WEBSITE_DESIGN_TEMPLATE_NAME } from '~/lib/websites/website-design-template';

import { createJobsService } from '~/home/[account]/jobs/_lib/server/jobs.service';
import { createProjectPhasesService } from '~/home/[account]/jobs/_lib/server/project-phases.service';

import {
  isMissingColumnError,
  isMissingRelationError,
  logMissingRelation,
} from '../../../_lib/server/supabase-errors';

function parseSitemapDocument(value: unknown): WebsiteSitemapDocument {
  return migrateSitemapDocument(value);
}

function parseWireframes(value: unknown): WebsiteWireframePage[] {
  if (!Array.isArray(value)) return [];
  return value as WebsiteWireframePage[];
}

type ContentDocRow = {
  id: string;
  title: string;
  content_md: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type WebsitePlanningBundle = {
  websiteId: string;
  jobId: string | null;
  sitemap: WebsiteSitemapPage[];
  sitemapComponents: WebsiteSitemapSymbol[];
  wireframes: WebsiteWireframePage[];
  contentDocs: WebsiteContentDoc[];
};

export function emptyWebsitePlanningBundle(
  websiteId: string,
): WebsitePlanningBundle {
  return {
    websiteId,
    jobId: null,
    sitemap: [],
    sitemapComponents: [],
    wireframes: [],
    contentDocs: [],
  };
}

export function createWebsitePlanningService(client: SupabaseClient) {
  return new WebsitePlanningService(client);
}

class WebsitePlanningService {
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
    if (role !== 'owner' && role !== 'admin' && role !== 'staff') {
      throw new Error('Permission denied');
    }
    return user;
  }

  private mapContentDoc(row: ContentDocRow): WebsiteContentDoc {
    return {
      id: row.id,
      title: row.title,
      contentMd: row.content_md ?? '',
      sortOrder: row.sort_order ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getPlanningBundle(
    accountId: string,
    websiteId: string,
  ): Promise<WebsitePlanningBundle | null> {
    await this.ensureCanView(accountId);

    type PlanningRow = {
      id: string;
      job_id?: string | null;
      sitemap?: unknown;
      wireframes?: unknown;
    };

    let row: PlanningRow | null = null;

    const planningQuery = await this.client
      .from('websites')
      .select('id, job_id, sitemap, wireframes')
      .eq('id', websiteId)
      .eq('business_id', accountId)
      .maybeSingle();

    if (planningQuery.error) {
      if (isMissingColumnError(planningQuery.error)) {
        logMissingRelation(
          'website_planning.getPlanningBundle',
          planningQuery.error,
        );

        const fallback = await this.client
          .from('websites')
          .select('id')
          .eq('id', websiteId)
          .eq('business_id', accountId)
          .maybeSingle();

        if (fallback.error || !fallback.data) {
          return null;
        }

        row = fallback.data as PlanningRow;
      } else {
        throw planningQuery.error;
      }
    } else if (!planningQuery.data) {
      return null;
    } else {
      row = planningQuery.data as PlanningRow;
    }

    let contentDocs: WebsiteContentDoc[] = [];

    const { data: docs, error: docsErr } = await this.client
      .from('website_content_docs')
      .select('id, title, content_md, sort_order, created_at, updated_at')
      .eq('website_id', websiteId)
      .eq('account_id', accountId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (docsErr) {
      if (isMissingRelationError(docsErr)) {
        logMissingRelation('website_planning.content_docs', docsErr);
      } else {
        throw docsErr;
      }
    } else {
      contentDocs = ((docs ?? []) as ContentDocRow[]).map((row) =>
        this.mapContentDoc(row),
      );
    }

    const sitemapDoc = parseSitemapDocument(row.sitemap);

    return {
      websiteId: row.id,
      jobId: row.job_id ?? null,
      sitemap: sitemapDoc.pages,
      sitemapComponents: sitemapDoc.components,
      wireframes: parseWireframes(row.wireframes),
      contentDocs,
    };
  }

  async getWebsiteForJob(accountId: string, jobId: string) {
    await this.ensureCanView(accountId);

    const { data, error } = await this.client
      .from('websites')
      .select('id, name')
      .eq('business_id', accountId)
      .eq('job_id', jobId)
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error)) {
        return null;
      }

      throw error;
    }

    if (!data) return null;

    return {
      id: data.id as string,
      name: (data.name as string) ?? 'Website',
    };
  }

  async saveSitemap(
    accountId: string,
    websiteId: string,
    sitemap: WebsiteSitemapPage[] | WebsiteSitemapDocument,
  ) {
    await this.ensureCanEdit(accountId);

    // Lazy upgrade: always persist the v1 document shape.
    const document = migrateSitemapDocument(sitemap);

    const { error } = await this.adminDb
      .from('websites')
      .update({
        sitemap: document,
        updated_at: new Date().toISOString(),
      })
      .eq('id', websiteId)
      .eq('business_id', accountId);

    if (error) {
      if (isMissingColumnError(error)) {
        throw new Error(
          'Website planning schema is not applied yet. Run `pnpm exec supabase db push` from apps/web (adds websites.sitemap).',
        );
      }
      throw error;
    }
    return { ok: true as const };
  }

  async saveWireframes(
    accountId: string,
    websiteId: string,
    wireframes: WebsiteWireframePage[],
  ) {
    await this.ensureCanEdit(accountId);

    const { error } = await this.adminDb
      .from('websites')
      .update({
        wireframes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', websiteId)
      .eq('business_id', accountId);

    if (error) {
      if (isMissingColumnError(error)) {
        throw new Error(
          'Website planning schema is not applied yet. Run `pnpm exec supabase db push` from apps/web (adds websites.wireframes).',
        );
      }
      throw error;
    }
    return { ok: true as const };
  }

  async linkJob(accountId: string, websiteId: string, jobId: string | null) {
    await this.ensureCanEdit(accountId);

    const { error } = await this.adminDb
      .from('websites')
      .update({
        job_id: jobId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', websiteId)
      .eq('business_id', accountId);

    if (error) {
      if (isMissingColumnError(error)) {
        throw new Error(
          'Website planning schema is not applied yet. Run `pnpm exec supabase db push` from apps/web (adds websites.job_id).',
        );
      }
      throw error;
    }
    return { ok: true as const };
  }

  /**
   * Create or link a delivery project, apply the Website design template when
   * the project has no phases yet, then store websites.job_id.
   */
  async createOrLinkDeliveryProject(input: {
    accountId: string;
    websiteId: string;
    existingJobId?: string;
  }): Promise<{ jobId: string }> {
    await this.ensureCanEdit(input.accountId);

    const websiteQuery = await this.client
      .from('websites')
      .select('id, name, client_org_id, job_id, business_id')
      .eq('id', input.websiteId)
      .eq('business_id', input.accountId)
      .maybeSingle();

    type WebsiteLinkRow = {
      id: string;
      name: string | null;
      client_org_id: string | null;
      job_id: string | null;
      business_id: string;
    };

    let website = websiteQuery.data as WebsiteLinkRow | null;

    if (websiteQuery.error) {
      if (!isMissingColumnError(websiteQuery.error)) {
        throw websiteQuery.error;
      }

      const fallback = await this.client
        .from('websites')
        .select('id, name, client_org_id, business_id')
        .eq('id', input.websiteId)
        .eq('business_id', input.accountId)
        .maybeSingle();

      if (fallback.error) throw fallback.error;
      if (!fallback.data) throw new Error('Website not found');

      website = {
        ...(fallback.data as Omit<WebsiteLinkRow, 'job_id'>),
        job_id: null,
      };
    }

    if (!website) throw new Error('Website not found');

    const { data: account } = await this.client
      .from('accounts')
      .select('slug')
      .eq('id', input.accountId)
      .maybeSingle();

    const accountSlug =
      (account as { slug?: string | null } | null)?.slug?.trim() ?? '';

    const jobsService = createJobsService(this.client);
    const phasesService = createProjectPhasesService(this.client);

    let jobId = input.existingJobId ?? null;
    let createdNew = false;

    if (!jobId) {
      let clientId: string | null = null;
      if (website.client_org_id) {
        const { data: clientRow } = await this.client
          .from('clients')
          .select('id')
          .eq('account_id', input.accountId)
          .eq('client_org_id', website.client_org_id)
          .limit(1)
          .maybeSingle();
        clientId = (clientRow as { id?: string } | null)?.id ?? null;
      }

      const job = await jobsService.createJob({
        accountId: input.accountId,
        title: `${website.name ?? 'Website'} — website build`,
        description:
          'Website delivery project created from Site Studio. Phases deep-link to the website planning tabs.',
        client_id: clientId ?? undefined,
        status: 'in_progress',
        priority: 'medium',
      });

      jobId = String((job as { id?: string }).id ?? '');
      createdNew = true;
    }

    if (!jobId) throw new Error('Could not resolve delivery project');

    if (accountSlug) {
      const existingPhases = createdNew
        ? []
        : await phasesService.listPhasesForJob({
            accountId: input.accountId,
            jobId,
          });

      if (existingPhases.length === 0) {
        const templates = await phasesService.listPhaseTemplates({
          accountId: input.accountId,
        });
        const template = templates.find(
          (item) => item.name === WEBSITE_DESIGN_TEMPLATE_NAME,
        );

        if (template) {
          await phasesService.applyPhaseTemplate({
            accountId: input.accountId,
            accountSlug,
            jobId,
            templateId: template.id,
          });
        }
      }
    }

    await this.linkJob(input.accountId, input.websiteId, jobId);
    return { jobId };
  }

  async createContentDoc(
    accountId: string,
    websiteId: string,
    title: string,
  ) {
    const user = await this.ensureCanEdit(accountId);

    const { data: maxRow, error: maxError } = await this.adminDb
      .from('website_content_docs')
      .select('sort_order')
      .eq('website_id', websiteId)
      .eq('account_id', accountId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) {
      if (isMissingRelationError(maxError)) {
        throw new Error(
          'Content docs schema is not applied yet. Run `pnpm exec supabase db push` from apps/web.',
        );
      }
      throw new Error(maxError.message);
    }

    const sortOrder = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;

    const { data, error } = await this.adminDb
      .from('website_content_docs')
      .insert({
        account_id: accountId,
        website_id: websiteId,
        title: title.trim() || 'Untitled',
        content_md: '',
        sort_order: sortOrder,
        created_by: user.id,
      })
      .select('id, title, content_md, sort_order, created_at, updated_at')
      .single();

    if (error) {
      if (isMissingRelationError(error)) {
        throw new Error(
          'Content docs schema is not applied yet. Run `pnpm exec supabase db push` from apps/web.',
        );
      }
      throw new Error(error.message);
    }

    return this.mapContentDoc(data as ContentDocRow);
  }

  async updateContentDoc(
    accountId: string,
    websiteId: string,
    docId: string,
    input: { title?: string; contentMd?: string },
  ) {
    await this.ensureCanEdit(accountId);

    const payload: Record<string, unknown> = {};
    if (input.title !== undefined) payload.title = input.title.trim() || 'Untitled';
    if (input.contentMd !== undefined) payload.content_md = input.contentMd;

    if (Object.keys(payload).length === 0) {
      throw new Error('No updates provided');
    }

    const { data, error } = await this.adminDb
      .from('website_content_docs')
      .update(payload)
      .eq('id', docId)
      .eq('website_id', websiteId)
      .eq('account_id', accountId)
      .select('id, title, content_md, sort_order, created_at, updated_at')
      .single();

    if (error) throw new Error(error.message);
    return this.mapContentDoc(data as ContentDocRow);
  }

  async deleteContentDoc(
    accountId: string,
    websiteId: string,
    docId: string,
  ) {
    await this.ensureCanEdit(accountId);

    const { error } = await this.adminDb
      .from('website_content_docs')
      .delete()
      .eq('id', docId)
      .eq('website_id', websiteId)
      .eq('account_id', accountId);

    if (error) throw new Error(error.message);
    return { ok: true as const };
  }
}
