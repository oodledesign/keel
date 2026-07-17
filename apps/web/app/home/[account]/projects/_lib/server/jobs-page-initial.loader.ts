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
): Promise<JobsPageInitialData> {
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
    campaignService.listProjects({ accountId }),
    client.rpc('get_account_members', { account_slug: accountSlug }),
  ]);

  const jobsPayload = jobsResult as { data?: unknown[]; total?: number };
  const campaignRows = Array.isArray(campaignsResult)
    ? campaignsResult
    : ((campaignsResult as { projects?: Array<{ id: string; name: string }> })
        ?.projects ?? []);

  return {
    jobs: jobsPayload.data ?? [],
    jobsTotal: jobsPayload.total ?? 0,
    campaigns: campaignRows.map((row) => ({
      id: row.id,
      name: row.name,
      clientCount: (row as { clientCount?: number }).clientCount,
    })),
    members:
      ((membersResult.data ?? []) as JobsPageInitialData['members']) ?? [],
  };
}
