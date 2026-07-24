import { Suspense } from 'react';

import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';
import { cn } from '@kit/ui/utils';

import { workspacePageMainClassName } from '~/components/workspace-shell/workspace-shell-styles';
import { EmailPageClient } from '~/home/(user)/email/_components/email-page-client';
import { loadEmailPageData } from '~/home/(user)/email/_lib/server/email-page.loader';
import { redirectIfEmailAssistantNotAllowed } from '~/lib/billing/require-email-assistant-access';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';

export const metadata = { title: 'Emails' };

type PageProps = {
  params: Promise<{ account: string }>;
};

async function BusinessEmailPageContent({
  accountSlug,
}: {
  accountSlug: string;
}) {
  const [, workspace] = await Promise.all([
    redirectIfEmailAssistantNotAllowed(),
    loadTeamWorkspace(accountSlug),
  ]);

  if (!workspace?.account) {
    notFound();
  }

  const initialData = await loadEmailPageData({
    mailboxKind: 'business',
    preferredAccountId: workspace.account.id,
    accountSlug,
  });

  return <EmailPageClient initialData={initialData} />;
}

async function BusinessEmailPage({ params }: PageProps) {
  const { account } = await params;

  return (
    <PageBody className="min-h-0 overflow-hidden bg-[var(--workspace-shell-canvas)]">
      <Suspense fallback={<EmailPageSkeleton />}>
        <BusinessEmailPageContent accountSlug={account} />
      </Suspense>
    </PageBody>
  );
}

function EmailPageSkeleton() {
  return (
    <div className={cn(workspacePageMainClassName, 'min-h-0')}>
      <div className="space-y-2 border-b border-[color:var(--workspace-shell-border)] pb-5">
        <div className="h-8 w-32 animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-xl bg-[var(--workspace-shell-sidebar-accent)]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="h-[480px] animate-pulse rounded-2xl bg-[var(--workspace-shell-sidebar-accent)]" />
        <div className="h-[480px] animate-pulse rounded-2xl bg-[var(--workspace-shell-sidebar-accent)]" />
      </div>
    </div>
  );
}

export default withI18n(BusinessEmailPage);
