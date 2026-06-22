'use client';

import { useCaptureException } from '@kit/monitoring/hooks';

import { WorkspaceErrorPageContent } from '~/components/workspace-error-page-content';

export default function HomeErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useCaptureException(error);

  return <WorkspaceErrorPageContent reset={reset} />;
}
