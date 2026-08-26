import { Suspense } from 'react';

import { PageBody } from '@kit/ui/page';
import { cn } from '@kit/ui/utils';

import { workspacePageMainClassName } from '~/components/workspace-shell/workspace-shell-styles';
import { redirectIfEmailAssistantNotAllowed } from '~/lib/billing/require-email-assistant-access';
import { withI18n } from '~/lib/i18n/with-i18n';

import { EmailPageClient } from './_components/email-page-client';
import { loadEmailPageData } from './_lib/server/email-page.loader';

export const metadata = { title: 'Personal email' };

async function EmailPageContent() {
  await redirectIfEmailAssistantNotAllowed();
  const initialData = await loadEmailPageData({ mailboxKind: 'personal' });
  return <EmailPageClient initialData={initialData} />;
}

function EmailPage() {
  return (
    <PageBody className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--workspace-shell-canvas)] py-0 lg:px-6">
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
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="h-[480px] animate-pulse rounded-2xl bg-[var(--workspace-shell-sidebar-accent)]" />
        <div className="h-[480px] animate-pulse rounded-2xl bg-[var(--workspace-shell-sidebar-accent)]" />
      </div>
    </div>
  );
}

export default withI18n(EmailPage);
