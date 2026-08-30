'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type { CampaignBrand } from '~/lib/campaigns/campaign-document';
import type { CampaignTemplateWorkspace } from '~/lib/campaigns/templates';
import { workspaceBtnPrimary } from '~/lib/workspace-ui';

import { createCampaignAction } from '../_lib/server/server-actions';
import { CampaignTemplateGallery } from './campaign-template-gallery';

export function CreateCampaignButton({
  accountId,
  accountSlug,
  brand,
  workspace,
}: {
  accountId: string;
  accountSlug: string;
  brand: CampaignBrand;
  workspace: CampaignTemplateWorkspace;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        className={workspaceBtnPrimary}
        disabled={pending}
        data-test="campaign-new"
        onClick={() => setOpen(true)}
      >
        {pending ? 'Creating…' : 'New campaign'}
      </Button>
      <CampaignTemplateGallery
        open={open}
        onOpenChange={setOpen}
        brand={brand}
        workspace={workspace}
        onSelect={({ template, document }) => {
          startTransition(async () => {
            try {
              const result = await createCampaignAction({
                accountId,
                accountSlug,
                name: template.name,
                subject: template.subject,
                previewText: template.previewText,
                bodyDocument: document,
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
      />
    </>
  );
}
