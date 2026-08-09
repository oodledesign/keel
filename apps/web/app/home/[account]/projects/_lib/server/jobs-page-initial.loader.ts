import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createCampaignProjectsService } from '../campaign/server/campaign-projects.service';
import { createJobsService } from './jobs.service';

export type JobsPageInitialData = {
  jobs: unknown[];
  jobsTotal: number;
  campaigns: Array<{ id: string; name: string; clientCount?: number }>;
  members: Array<{
    user_id: string;
    name: string | null;
    email: string | null;
    picture_url?: string | null;
  }>;
};

export async function loadJobsPageInitialData(
  accountSlug: string,
  accountId: string,
  options?: {
    includeCampaigns?: boolean;
    includeMembers?: boolean;
  },
): Promise<JobsPageInitialData> {
  const includeCampaigns = options?.includeCampaigns ?? true;
  const includeMembers = options?.includeMembers ?? true;
  const client = getSupabaseServerClient();
  const jobsService = createJobsService(client);
  const campaignService = createCampaignProjectsService(client);

  const [jobsResult, campaignsResult, membersResult] = await Promise.all([
    jobsService.listJobs({
      accountId,
      tab: 'all',
      page: 1,
      pageSize: 50,
    }),
    includeCampaigns
      ? campaignService.listProjects({ accountId })
      : Promise.resolve([]),
    includeMembers
      ? client.rpc('get_account_members', { account_slug: accountSlug })
      : Promise.resolve({ data: [] }),
  ]);

  const jobsPayload = jobsResult as { data?: unknown[]; total?: number };
  const campaignRows = Array.isArray(campaignsResult)
    ? campaignsResult
    : ((campaignsResult as { projects?: Array<{ id: string; name: string }> })
        ?.projects ?? []);

  return {
    jobs: jobsPayload.data ?? [],
    jobsTotal: jobsPayload.total ?? 0,
    campaigns: includeCampaigns
      ? campaignRows.map((row) => ({
          id: row.id,
          name: row.name,
          clientCount: (row as { clientCount?: number }).clientCount,
        }))
      : [],
    members: includeMembers
      ? (((membersResult as { data?: JobsPageInitialData['members'] }).data ??
          []) as JobsPageInitialData['members'])
      : [],
  };
}
