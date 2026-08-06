'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { acceptClientPortalInviteAction } from '~/lib/clients/client-portal-invites-actions';

function clientPortalPath(clientOrgSlug: string) {
  return pathsConfig.app.clientPortalHome.replace(
    '[clientSlug]',
    clientOrgSlug,
  );
}

export function AcceptPortalInviteForm(props: {
  token: string;
  clientOrgSlug: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <Button
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const invite = await acceptClientPortalInviteAction({
                token: props.token,
              });
              toast.success('Portal access granted');
              const slug = invite.clientOrgSlug ?? props.clientOrgSlug;
              if (slug) {
                router.replace(clientPortalPath(slug));
              } else {
                router.replace(pathsConfig.app.home);
              }
              router.refresh();
            } catch (e) {
              const message =
                e instanceof Error ? e.message : 'Could not accept invite';
              setError(message);
              toast.error(message);
            }
          });
        }}
      >
        {pending ? 'Accepting…' : 'Accept invite'}
      </Button>

      <p className="text-muted-foreground text-xs">
        You&apos;ll get your own login for this client portal — not team access
        to the agency workspace.
      </p>

      <Button asChild variant="ghost" size="sm">
        <a href={pathsConfig.app.home}>Back to home</a>
      </Button>
    </div>
  );
}
