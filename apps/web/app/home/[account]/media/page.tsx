import Link from 'next/link';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { isWorkModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { MediaGalleryClient } from './_components/media-gallery-client';

interface MediaGalleryPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ job?: string; project?: string; client?: string; type?: string }>;
}

export const generateMetadata = async () => ({
  title: 'Media gallery',
});

async function MediaGalleryPage({ params, searchParams }: MediaGalleryPageProps) {
  const { account: accountSlug } = await params;
  const query = await searchParams;
  const workspace = await loadTeamWorkspace(accountSlug);
  const accountId = workspace.account.id as string;

  // Gallery stays readable even if module disabled — do not gate on module here.
  void isWorkModuleEnabled;

  const client = getSupabaseServerClient();
  let jobsQuery = client
    .from('media_generation_jobs')
    .select(
      'id, status, type, file_url, thumbnail_url, prompt, error_message, media_credits_charged, created_at, project_id, client_id, model_id, params, promoted_from_job_id',
    )
    .eq('account_id', accountId)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(100);

  if (query.project) jobsQuery = jobsQuery.eq('project_id', query.project);
  if (query.client) jobsQuery = jobsQuery.eq('client_id', query.client);
  if (query.type === 'image' || query.type === 'video') {
    jobsQuery = jobsQuery.eq('type', query.type);
  }

  const [{ data: jobs }, { data: projects }, { data: clients }] =
    await Promise.all([
      jobsQuery,
      client
        .from('projects')
        .select('id, title, name')
        .eq('account_id', accountId)
        .limit(200),
      client
        .from('clients')
        .select('id, display_name, company_name')
        .eq('account_id', accountId)
        .limit(200),
    ]);

  return (
    <PageBody className="space-y-4 px-4 py-6 md:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Media gallery</h1>
          <p className="text-muted-foreground text-sm">
            Generated images and video for this workspace.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href={`/home/${accountSlug}/generate`} className="underline">
            Generate
          </Link>
          <Link
            href={`/home/${accountSlug}/settings/billing`}
            className="underline"
          >
            Media units
          </Link>
        </div>
      </div>
      <MediaGalleryClient
        accountId={accountId}
        accountSlug={accountSlug}
        initialJobs={(jobs ?? []) as Array<Record<string, unknown>>}
        projects={(projects ?? []) as Array<{ id: string; title?: string | null; name?: string | null }>}
        clients={
          (clients ?? []) as Array<{
            id: string;
            display_name?: string | null;
            company_name?: string | null;
          }>
        }
        initialJobId={query.job ?? null}
        initialProjectId={query.project ?? null}
        initialClientId={query.client ?? null}
        initialType={query.type ?? null}
      />
    </PageBody>
  );
}

export default withI18n(MediaGalleryPage);
