'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { workspaceBtnPrimary } from '~/lib/workspace-ui';

import { createCampaignAction } from '../_lib/server/server-actions';

export function CreateCampaignButton({
  accountId,
  accountSlug,
}: {
  accountId: string;
  accountSlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      className={workspaceBtnPrimary}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            const result = await createCampaignAction({
              accountId,
              accountSlug,
              name: 'Untitled campaign',
            });
            router.push(
              pathsConfig.app.accountEmailCampaignDetail
                .replace('[account]', accountSlug)
                .replace('[campaignId]', result.campaignId),
            );
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : 'Could not create campaign',
            );
          }
        });
      }}
    >
      {pending ? 'Creating…' : 'New campaign'}
    </Button>
  );
}
