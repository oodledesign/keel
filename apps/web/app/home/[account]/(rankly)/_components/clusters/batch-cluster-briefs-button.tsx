'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

export function BatchClusterBriefsButton(props: {
  accountId: string;
  projectId: string;
  clusterJobId: string;
  country: string;
  spokeCount: number;
  briefsPath: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleBatch = async () => {
    if (
      !window.confirm(
        `Generate ${props.spokeCount} content briefs? Each uses quick-mode credits.`,
      )
    ) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/rankly/briefs/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          accountId: props.accountId,
          clusterJobId: props.clusterJobId,
          country: props.country,
        }),
      });

      const json = (await res.json()) as ApiResponse<{ count: number }>;
      if (!json.ok) {
        throw new Error(json.error.message);
      }

      toast.success(`Started ${json.data.count} brief jobs`);
      router.push(props.briefsPath);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (props.spokeCount === 0) {
    return null;
  }

  return (
    <Button onClick={() => void handleBatch()} disabled={loading}>
      {loading
        ? 'Starting briefs…'
        : `Generate all ${props.spokeCount} spoke briefs`}
    </Button>
  );
}
