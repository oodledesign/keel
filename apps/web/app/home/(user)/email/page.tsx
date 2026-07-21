import { Suspense } from 'react';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import { workspacePageMainClassName } from '~/components/workspace-shell/workspace-shell-styles';
import { cn } from '@kit/ui/utils';
import { redirectIfEmailAssistantNotAllowed } from '~/lib/billing/require-email-assistant-access';

import { EmailPageClient } from './_components/email-page-client';
import { loadEmailPageData } from './_lib/server/email-page.loader';

export const metadata = { title: 'Email' };

async function EmailPageContent() {
  await redirectIfEmailAssistantNotAllowed();
  const initialData = await loadEmailPageData();
  return <EmailPageClient initialData={initialData} />;
}

function EmailPage() {
  return (
    <PageBody className="min-h-0 overflow-hidden bg-[var(--workspace-shell-canvas)]">
      <Suspense fallback={<EmailPageSkeleton />}>
        <EmailPageContent />
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

export default withI18n(EmailPage);
