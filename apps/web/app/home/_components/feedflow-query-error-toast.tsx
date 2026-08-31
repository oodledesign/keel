'use client';

import { useEffect, useRef } from 'react';

import { useSearchParams } from 'next/navigation';

import { toast } from '@kit/ui/sonner';

/**
 * Safety net when OAuth errors land on a workspace page that does not
 * render FeedflowOauthBanner (e.g. /app → default workspace).
 */
export function FeedflowQueryErrorToast() {
  const searchParams = useSearchParams();
  const shown = useRef<string | null>(null);
  const error = searchParams.get('feedflow_error');

  useEffect(() => {
    if (!error || shown.current === error) {
      return;
    }
    shown.current = error;
    toast.error(error);
  }, [error]);

  return null;
}
