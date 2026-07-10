'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createJobsService } from '~/home/[account]/jobs/_lib/server/jobs.service';
import { createProjectPhasesService } from '~/home/[account]/jobs/_lib/server/project-phases.service';
import { WEBSITE_DESIGN_TEMPLATE_NAME } from '~/lib/websites/website-design-template';

import {
  CreateWebsiteProjectSchema,
  CreateWebsiteShareSchema,
  GenerateWebsiteSeoPageSchema,
  GenerateWebsiteSitemapSchema,
  GenerateWebsiteWireframesSchema,
  GetSiteStudioBundleSchema,
  RevokeWebsiteShareSchema,
  SaveWebsiteBriefSchema,
  SaveWebsiteSeoPageSchema,
  SaveWebsiteStyleSystemSchema,
  SetShareApprovalSchema,
  SetWebsitePortalScopeSchema,
  SuggestWebsiteBriefSchema,
} from '../schema/site-studio.schema';
import {
  createSiteStudioService,
  setShareApprovalByToken,
} from './site-studio.service';
import { createWebsitePlanningService } from './website-planning.service';

function getService() {
  return createSiteStudioService(getSupabaseServerClient());
}

export const getSiteStudioBundle = enhanceAction(
  async (input) => getService().getBundle(input.accountId, input.websiteId),
  { schema: GetSiteStudioBundleSchema },
);

export const saveWebsiteBrief = enhanceAction(
  async (input) =>
    getService().saveBrief(input.accountId, input.websiteId, input.brief),
  { schema: SaveWebsiteBriefSchema },
);

export const suggestWebsiteBrief = enhanceAction(
  async (input) =>
    getService().suggestBrief(input.accountId, input.websiteId, {
      notes: input.notes,
      websiteUrl: input.websiteUrl,
    }),
  { schema: SuggestWebsiteBriefSchema },
);

export const generateWebsiteSitemap = enhanceAction(
  async (input) =>
    getService().generateSitemap(input.accountId, input.websiteId, input.mode),
  { schema: GenerateWebsiteSitemapSchema },
);

export const generateWebsiteWireframes = enhanceAction(
  async (input) =>
    getService().generateWireframesForPage(
      input.accountId,
      input.websiteId,
      input.pageId,
    ),
  { schema: GenerateWebsiteWireframesSchema },
);

export const saveWebsiteStyleSystem = enhanceAction(
  async (input) =>
    getService().saveStyleSystem(input.accountId, input.websiteId, input.style),
  { schema: SaveWebsiteStyleSystemSchema },
);

export const suggestWebsiteStyle = enhanceAction(
  async (input) => getService().suggestStyle(input.accountId, input.websiteId),
  { schema: GetSiteStudioBundleSchema },
);

export const saveWebsiteSeoPage = enhanceAction(
  async (input) =>
    getService().saveSeoPage(
      input.accountId,
      input.websiteId,
      input.pageId,
      input.fields,
    ),
  { schema: SaveWebsiteSeoPageSchema },
);

export const generateWebsiteSeoPage = enhanceAction(
  async (input) =>
    getService().generateSeoPage(input.accountId, input.websiteId, input.pageId),
  { schema: GenerateWebsiteSeoPageSchema },
);

export const createWebsiteShare = enhanceAction(
  async (input) =>
    getService().createShare(input.accountId, input.websiteId, input.scope),
  { schema: CreateWebsiteShareSchema },
);

export const revokeWebsiteShare = enhanceAction(
  async (input) =>
    getService().revokeShare(input.accountId, input.websiteId, input.shareId),
  { schema: RevokeWebsiteShareSchema },
);

export const setWebsitePortalScope = enhanceAction(
  async (input) =>
    getService().setPortalScope(input.accountId, input.websiteId, input.scope),
  { schema: SetWebsitePortalScopeSchema },
);

/** Public share approval — token-authenticated, no session required. */
export const setWebsiteShareApproval = enhanceAction(
  async (input) =>
    setShareApprovalByToken({
      token: input.token,
      pageId: input.pageId,
      status: input.status,
      note: input.note,
    }),
  { schema: SetShareApprovalSchema, auth: false },
);

/**
 * Create (or link) a delivery project for a website and apply the
 * Website design phase template, then deep-link the job to the website.
 */
export const createWebsiteProject = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const jobsService = createJobsService(client);
    const phasesService = createProjectPhasesService(client);
    const planningService = createWebsitePlanningService(client);

    const { data: website, error } = await client
      .from('websites')
      .select('id, name, client_org_id, job_id, business_id')
      .eq('id', input.websiteId)
      .eq('business_id', input.accountId)
      .maybeSingle();

    if (error) throw error;
    if (!website) throw new Error('Website not found');

    const { data: account } = await client
      .from('accounts')
      .select('slug')
      .eq('id', input.accountId)
      .maybeSingle();

    const accountSlug = (account as { slug?: string } | null)?.slug ?? '';

    let jobId = input.existingJobId ?? null;

    if (!jobId) {
      // Resolve CRM client from the linked client org (if any).
      let clientId: string | null = null;
      if (website.client_org_id) {
        const { data: clientRow } = await client
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
        title: `${(website.name as string) ?? 'Website'} — website build`,
        description:
          'Website delivery project created from Site Studio. Phases deep-link to the website planning tabs.',
        client_id: clientId ?? undefined,
        status: 'in_progress',
        priority: 'medium',
      });

      jobId = String((job as Record<string, unknown>).id ?? '');

      // Ensure templates exist (also seeds/refreshes Website design), then apply it.
      const templates = await phasesService.listPhaseTemplates({
        accountId: input.accountId,
      });
      const template = templates.find(
        (item) => item.name === WEBSITE_DESIGN_TEMPLATE_NAME,
      );

      if (template && accountSlug) {
        await phasesService.applyPhaseTemplate({
          accountId: input.accountId,
          accountSlug,
          jobId,
          templateId: template.id,
        });
      }
    }

    await planningService.linkJob(input.accountId, input.websiteId, jobId);

    return { jobId };
  },
  { schema: CreateWebsiteProjectSchema },
);
