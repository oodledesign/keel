'use client';

import { usePathname } from 'next/navigation';

import { useCaptureException } from '@kit/monitoring/hooks';
import { useUser } from '@kit/supabase/hooks/use-user';

import { SiteHeader } from '~/(marketing)/_components/site-header';
import { ErrorPageContent } from '~/components/error-page-content';
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

const ErrorPage = ({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) => {
  useCaptureException(error);

  const pathname = usePathname();
  const user = useUser();

  if (isDashboardPath(pathname)) {
    return <WorkspaceErrorPageContent reset={reset} />;
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
};

export default ErrorPage;
