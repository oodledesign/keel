'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Eye, Send } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import {
  type CampaignDocument,
  createCampaignBlock,
  resolveCampaignDocument,
} from '~/lib/campaigns/campaign-document';
import type { EmailCampaign } from '~/lib/campaigns/campaign.types';
import {
  CAMPAIGN_FORM_URL_TOKEN,
  formUrlForMerge,
} from '~/lib/campaigns/form-link';
import { mergeValuesForRecipient } from '~/lib/campaigns/merge-fields';
import { previewCampaignHtml } from '~/lib/campaigns/preview-campaign-html';
import type { CampaignTemplateWorkspace } from '~/lib/campaigns/templates';
import { workspaceBtnPrimary } from '~/lib/workspace-ui';

import { updateCampaignAction } from '../_lib/server/server-actions';
import { CampaignBodyEditor } from './campaign-body-editor';
import {
  CampaignFormLinkCard,
  type CampaignFormOption,
} from './campaign-form-link-card';
import { CampaignPreviewDialog } from './campaign-preview-dialog';
import { CampaignTemplateGallery } from './campaign-template-gallery';

export function CampaignContentPanel({
  accountId,
  accountSlug,
  campaign,
  brand,
  publishedForms,
  workspace,
}: {
  accountId: string;
  accountSlug: string;
  campaign: EmailCampaign;
  brand: {
    primary_color: string;
    secondary_color?: string | null;
    accent_color?: string | null;
    logo_url: string | null;
    website_url?: string | null;
    contact_email: string | null;
  };
  publishedForms: CampaignFormOption[];
  workspace: CampaignTemplateWorkspace;
}) {
  const router = useRouter();
  const editable =
    campaign.status === 'draft' || campaign.status === 'scheduled';
  const [document, setDocument] = useState<CampaignDocument>(() =>
    resolveCampaignDocument(campaign.bodyDocument, campaign.htmlBody, brand),
  );
  const [subject, setSubject] = useState(campaign.subject);
  const [previewText, setPreviewText] = useState(campaign.previewText ?? '');
  const [name, setName] = useState(campaign.name);
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>(
    'desktop',
  );
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const useTemplateLabel =
    !subject.trim() && name === 'Untitled campaign'
      ? 'Use a template'
      : 'Change template';

  const previewHtml = useMemo(
    () =>
      previewCampaignHtml({
        brand,
        document,
        merge: mergeValuesForRecipient({
          displayName: 'Alex Taylor',
          email: 'alex@example.com',
          formUrl: formUrlForMerge({
            formLink: document.formLink,
            recipientEmail: 'alex@example.com',
          }),
        }),
      }),
    [brand, document],
  );

  const sendHref = pathsConfig.app.accountEmailCampaignSend
    .replace('[account]', accountSlug)
    .replace('[campaignId]', campaign.id);
  const settingsHref = pathsConfig.app.accountEmailCampaignDetail
    .replace('[account]', accountSlug)
    .replace('[campaignId]', campaign.id);

  const save = () =>
    updateCampaignAction({
      accountId,
      accountSlug,
      campaignId: campaign.id,
      name,
      subject,
      previewText,
      bodyDocument: document,
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Build the email with blocks, form links, and templates. Preview opens
          in a popup.
        </p>
        {editable ? (
          <Button
            type="button"
            variant="outline"
            data-test="campaign-use-template"
            onClick={() => setGalleryOpen(true)}
          >
            {useTemplateLabel}
          </Button>
        ) : null}
      </div>

      <CampaignTemplateGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        brand={brand}
        workspace={workspace}
        requireConfirm
        onSelect={({ template, document: nextDocument }) => {
          setDocument((current) => ({
            ...nextDocument,
            formLink: current.formLink,
          }));
          setSubject(template.subject);
          setPreviewText(template.previewText);
          if (name === 'Untitled campaign') {
            setName(template.name);
          }
        }}
      />

      <CampaignFormLinkCard
        forms={publishedForms}
        formLink={document.formLink ?? null}
        disabled={!editable || pending}
        onChange={(next) =>
          setDocument((current) => ({ ...current, formLink: next }))
        }
        onInsertFormButton={() => {
          setDocument((current) => {
            const button = createCampaignBlock('button');
            if (button.type === 'button') {
              button.label = current.formLink?.formName
                ? `Open ${current.formLink.formName}`
                : 'Open form';
              button.href = CAMPAIGN_FORM_URL_TOKEN;
            }
            const blocks = [...current.blocks];
            const footerIndex = blocks.findIndex(
              (block) => block.type === 'footer',
            );
            if (footerIndex >= 0) {
              blocks.splice(footerIndex, 0, button);
            } else {
              blocks.push(button);
            }
            return { ...current, blocks };
          });
        }}
      />

      <CampaignBodyEditor
        key={document.blocks[0]?.id ?? 'empty'}
        document={document}
        brand={brand}
        onChange={setDocument}
        disabled={!editable}
        previewWidth={previewWidth}
        onPreviewWidthChange={setPreviewWidth}
      />

      <CampaignPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        html={previewHtml}
        previewWidth={previewWidth}
        onPreviewWidthChange={setPreviewWidth}
      />

      <div className="flex flex-wrap gap-2">
        {editable ? (
          <Button
            variant="secondary"
            disabled={pending}
            data-test="campaign-save-content"
            onClick={() => {
              startTransition(async () => {
                try {
                  await save();
                  toast.success('Content saved');
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : 'Could not save',
                  );
                }
              });
            }}
          >
            Save draft
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          data-test="campaign-preview-open"
          onClick={() => {
            startTransition(async () => {
              try {
                if (editable) {
                  await save();
                }
                setPreviewOpen(true);
                router.refresh();
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : 'Could not open preview',
                );
              }
            });
          }}
        >
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </Button>
        <Button asChild variant="outline">
          <Link href={settingsHref}>Settings</Link>
        </Button>
        <Button asChild className={workspaceBtnPrimary} data-test="campaign-content-goto-send">
          <Link href={sendHref}>
            <Send className="mr-2 h-4 w-4" />
            Send
          </Link>
        </Button>
      </div>
    </div>
  );
}
