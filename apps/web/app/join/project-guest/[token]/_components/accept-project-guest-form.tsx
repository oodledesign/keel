'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { acceptProjectGuestInviteAction } from '~/lib/projects/project-guests-actions';

function guestProjectPath(projectId: string) {
  return pathsConfig.app.personalGuestProject.replace('[projectId]', projectId);
}

export function AcceptProjectGuestForm(props: { token: string }) {
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
              const guest = await acceptProjectGuestInviteAction({
                token: props.token,
              });
              toast.success('Invite accepted');
              router.replace(guestProjectPath(guest.projectId));
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
        You will only see this project&apos;s task board — not clients,
        invoices, or other workspace settings.
      </p>

      <Button asChild variant="ghost" size="sm">
        <a href={pathsConfig.app.home}>Back to home</a>
      </Button>
    </div>
  );
}
