import { Suspense } from 'react';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
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
    <PageBody className="bg-[var(--workspace-shell-canvas)]">
      <Suspense fallback={<EmailPageSkeleton />}>
        <EmailPageContent />
      </Suspense>
    </PageBody>
  );
}

function EmailPageSkeleton() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 px-3 pb-8 pt-3 md:px-6 md:pb-12 md:pt-6">
      <div className="space-y-2 border-b border-white/10 pb-5">
        <div className="h-8 w-32 animate-pulse rounded-xl bg-white/[0.04]" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-xl bg-white/[0.04]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="h-[480px] animate-pulse rounded-2xl bg-white/[0.04]" />
        <div className="h-[480px] animate-pulse rounded-2xl bg-white/[0.04]" />
      </div>
    </div>
  );
}

export default withI18n(EmailPage);
