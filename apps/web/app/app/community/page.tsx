import Link from 'next/link';

import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export const metadata = { title: 'Community' };

async function CommunitySpacePage() {
  await requireUserInServerComponent();

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)]">
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-[1.5rem] font-semibold tracking-tight">
          Community
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Schedule, tasks, and notes will live here for community spaces, with
          invites and roles aligned to work and family.
        </p>
        <Link
          href={pathsConfig.app.home}
          className="text-primary text-sm font-medium underline-offset-4 hover:underline"
        >
          Back to home
        </Link>
      </div>
    </PageBody>
  );
}

export default withI18n(CommunitySpacePage);
