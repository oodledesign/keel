'use client';

import { usePathname } from 'next/navigation';

import { useCaptureException } from '@kit/monitoring/hooks';
import { useUser } from '@kit/supabase/hooks/use-user';

import { SiteHeader } from '~/(marketing)/_components/site-header';
import { ErrorPageContent } from '~/components/error-page-content';
import { RootProviders } from '~/components/root-providers';
import { WorkspaceErrorPageContent } from '~/components/workspace-error-page-content';

function isDashboardPath(pathname: string | null) {
  if (!pathname) return false;

  return (
    pathname.startsWith('/app') ||
    pathname.startsWith('/home') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/portal') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/setup')
  );
}

const GlobalErrorPage = ({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) => {
  useCaptureException(error);

  return (
    <html lang="en">
      <body>
        <RootProviders>
          <GlobalErrorContent reset={reset} />
        </RootProviders>
      </body>
    </html>
  );
};

function GlobalErrorContent({ reset }: { reset: () => void }) {
  const pathname = usePathname();
  const user = useUser();

  if (isDashboardPath(pathname)) {
    return (
      <div className="flex min-h-screen flex-1 flex-col bg-[var(--workspace-shell-canvas)]">
        <WorkspaceErrorPageContent reset={reset} />
      </div>
    );
  }

  return (
    <div className={'flex h-screen flex-1 flex-col'}>
      <SiteHeader user={user.data} />

      <ErrorPageContent
        statusCode={'common:errorPageHeading'}
        heading={'common:genericError'}
        subtitle={'common:genericErrorSubHeading'}
        backLabel={'common:goBack'}
        reset={reset}
      />
    </div>
  );
}

export default GlobalErrorPage;
