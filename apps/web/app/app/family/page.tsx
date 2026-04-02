import Link from 'next/link';

import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export const metadata = { title: 'Family' };

async function FamilySpacePage() {
  await requireUserInServerComponent();

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)]">
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-[1.5rem] font-semibold tracking-tight">Family</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Calendar, shopping, and meal planning will live here for shared family
          spaces, using the same accounts and memberships model as work.
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

export default withI18n(FamilySpacePage);
