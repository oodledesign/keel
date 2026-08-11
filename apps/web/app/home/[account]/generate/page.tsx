import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { MediaGeneratePanel } from '~/components/media/media-generate-panel';
import { withI18n } from '~/lib/i18n/with-i18n';

import { isMediaGenerateModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';

interface GeneratePageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Generate',
});

async function GeneratePage({ params }: GeneratePageProps) {
  const { account: accountSlug } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ADDON_APPS_SPACE_TYPES);

  if (!isMediaGenerateModuleEnabled(workspace.moduleSettings)) {
    notFound();
  }

  const accountId = workspace.account.id as string;

  return (
    <PageBody className="space-y-4 px-4 py-6 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Generate</h1>
          <p className="text-muted-foreground text-sm">
            Create images and video with media units. Linking a project is
            optional.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href={`/home/${accountSlug}/media`} className="underline">
            Media gallery
          </Link>
          <Link
            href={`/home/${accountSlug}/settings/billing`}
            className="underline"
          >
            Media units
          </Link>
        </div>
      </div>
      <MediaGeneratePanel accountId={accountId} accountSlug={accountSlug} />
    </PageBody>
  );
}

export default withI18n(GeneratePage);
