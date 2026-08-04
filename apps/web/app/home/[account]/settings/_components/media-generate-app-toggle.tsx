'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import Link from 'next/link';

import { Switch } from '@kit/ui/switch';
import { Label } from '@kit/ui/label';

type MediaGenerateAppToggleProps = {
  accountId: string;
  accountSlug: string;
  billingHref: string;
};

export function MediaGenerateAppToggle(props: MediaGenerateAppToggleProps) {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/media/app?accountId=${props.accountId}`);
    if (!res.ok) {
      setError('Could not load media app status.');
      return;
    }
    const json = (await res.json()) as { enabled: boolean };
    setEnabled(json.enabled);
    setLoaded(true);
    setError(null);
  }, [props.accountId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onToggle = (next: boolean) => {
    startTransition(async () => {
      const res = await fetch('/api/media/app', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: props.accountId, enabled: next }),
      });
      if (!res.ok) {
        setError('Could not update media app.');
        return;
      }
      setEnabled(next);
      setError(null);
    });
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">Media Generate</p>
          <p className="text-muted-foreground text-sm">
            Generate images and video with fal.ai, billed in media units.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={enabled}
            disabled={!loaded || pending}
            onCheckedChange={onToggle}
            id="media-generate-toggle"
          />
          <Label htmlFor="media-generate-toggle">
            {enabled ? 'Enabled' : 'Disabled'}
          </Label>
        </div>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {enabled ? (
        <p className="text-muted-foreground text-sm">
          <Link href={props.billingHref} className="underline">
            View media unit balance &amp; top up
          </Link>
          {' · '}
          <Link
            href={`/home/${props.accountSlug}/generate`}
            className="underline"
          >
            Generate
          </Link>
          {' · '}
          <Link
            href={`/home/${props.accountSlug}/media`}
            className="underline"
          >
            Gallery
          </Link>
        </p>
      ) : null}
    </div>
  );
}
