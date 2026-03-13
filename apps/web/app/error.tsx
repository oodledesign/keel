'use client';

import { useCaptureException } from '@kit/monitoring/hooks';
import { useUser } from '@kit/supabase/hooks/use-user';

import { SiteHeader } from '~/(marketing)/_components/site-header';
import { ErrorPageContent } from '~/components/error-page-content';

const ErrorPage = ({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) => {
  useCaptureException(error);

  const user = useUser();

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
