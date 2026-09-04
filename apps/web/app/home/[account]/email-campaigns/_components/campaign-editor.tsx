'use client';

import { useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { ArrowLeft, Eye } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  type CampaignDocument,
  createCampaignBlock,
  resolveCampaignDocument,
} from '~/lib/campaigns/campaign-document';
import type {
  CampaignCreditPool,
  EmailCampaign,
  EmailCampaignRecipient,
} from '~/lib/campaigns/campaign.types';
import {
  CAMPAIGN_FORM_URL_TOKEN,
  formUrlForMerge,
} from '~/lib/campaigns/form-link';
import { mergeValuesForRecipient } from '~/lib/campaigns/merge-fields';
import { previewCampaignHtml } from '~/lib/campaigns/preview-campaign-html';
import type { CampaignTemplateWorkspace } from '~/lib/campaigns/templates';
import {
  workspaceBtnPrimary,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  cancelScheduleCampaignAction,
  scheduleCampaignAction,
  sendCampaignAction,
  updateCampaignAction,
} from '../_lib/server/server-actions';
import { CampaignBodyEditor } from './campaign-body-editor';
import {
  CampaignFormLinkCard,
  type CampaignFormOption,
} from './campaign-form-link-card';
import {
  CampaignFromPicker,
  type CampaignSendingDomainOption,
} from './campaign-from-picker';
import { CampaignRecipientLog } from './campaign-recipient-log';
import { CampaignSendTestDialog } from './campaign-send-test-dialog';
import { CampaignTemplateGallery } from './campaign-template-gallery';

type EditorStep = 'edit' | 'preview';

export function CampaignEditor({
  accountId,
  accountSlug,
  campaign,
  recipients,
  subscriberCount,
  usage,
  brand,
  sendingDomain,
  publishedForms,
  workspace,
}: {
  accountId: string;
  accountSlug: string;
  campaign: EmailCampaign;
  recipients: EmailCampaignRecipient[];
  subscriberCount: number;
  usage: CampaignCreditPool;
  brand: {
    primary_color: string;
    secondary_color?: string | null;
    accent_color?: string | null;
    logo_url: string | null;
    website_url?: string | null;
    contact_email: string | null;
  };
  sendingDomain: CampaignSendingDomainOption | null;
  publishedForms: CampaignFormOption[];
  workspace: CampaignTemplateWorkspace;
}) {
  const router = useRouter();
  const editable =
    campaign.status === 'draft' || campaign.status === 'scheduled';
  const [step, setStep] = useState<EditorStep>(editable ? 'edit' : 'preview');
  const [name, setName] = useState(campaign.name);
  const [subject, setSubject] = useState(campaign.subject);
  const [previewText, setPreviewText] = useState(campaign.previewText ?? '');
  const [fromName, setFromName] = useState(campaign.fromName ?? '');
  const [fromEmail, setFromEmail] = useState(() => {
    if (campaign.fromEmail) return campaign.fromEmail;
    if (sendingDomain?.verified) {
      return `${sendingDomain.defaultLocalPart}@${sendingDomain.sendingHost}`;
    }
    return '';
  });
  const [replyTo, setReplyTo] = useState(campaign.replyTo ?? '');
  const [document, setDocument] = useState<CampaignDocument>(() =>
    resolveCampaignDocument(campaign.bodyDocument, campaign.htmlBody, brand),
  );
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>(
    'desktop',
  );
  const [scheduledAt, setScheduledAt] = useState('');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [sendTestOpen, setSendTestOpen] = useState(false);
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

  const save = () =>
    updateCampaignAction({
      accountId,
      accountSlug,
      campaignId: campaign.id,
      name,
      subject,
      previewText,
      bodyDocument: document,
      fromName: fromName.trim() || null,
      fromEmail: fromEmail.trim() || null,
      replyTo: replyTo.trim() || null,
    });

  const goToPreview = () => {
    startTransition(async () => {
      try {
        if (editable) {
          await save();
          toast.success('Draft saved');
        }
        setStep('preview');
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save draft',
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span
            className={
              step === 'edit'
                ? `font-semibold ${workspaceText}`
                : workspaceTextMuted
            }
          >
            1. Edit
          </span>
          <span className={workspaceTextMuted}>/</span>
          <span
            className={
              step === 'preview'
                ? `font-semibold ${workspaceText}`
                : workspaceTextMuted
            }
          >
            2. Preview &amp; send
          </span>
        </div>
        {step === 'preview' ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            data-test="campaign-back-to-edit"
            onClick={() => setStep('edit')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to editor
          </Button>
        ) : null}
      </div>

      {step === 'edit' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Internal name</Label>
              <Input
                id="campaign-name"
                value={name}
                disabled={!editable}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-subject">Subject</Label>
              <Input
                id="campaign-subject"
                value={subject}
                disabled={!editable}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-[16rem] flex-1 space-y-2">
              <Label htmlFor="campaign-preview">Preview text</Label>
              <Input
                id="campaign-preview"
                value={previewText}
                disabled={!editable}
                onChange={(event) => setPreviewText(event.target.value)}
              />
            </div>
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

          <div className={`${workspacePanelCard} space-y-3 p-4`}>
            <CampaignFromPicker
              sendingDomain={sendingDomain}
              fromName={fromName}
              fromEmail={fromEmail}
              replyTo={replyTo}
              disabled={!editable || pending}
              fallbackFromLabel={brand.contact_email}
              onFromNameChange={setFromName}
              onFromEmailChange={setFromEmail}
              onReplyToChange={setReplyTo}
            />
          </div>

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

          <div className="flex flex-wrap gap-2">
            {editable ? (
              <Button
                variant="secondary"
                disabled={pending}
                data-test="campaign-save-draft"
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await save();
                      toast.success('Draft saved');
                      router.refresh();
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : 'Could not save',
                      );
                    }
                  });
                }}
              >
                Save draft
              </Button>
            ) : null}
            <Button
              className={workspaceBtnPrimary}
              disabled={pending}
              data-test="campaign-preview-send"
              onClick={goToPreview}
            >
              <Eye className="mr-2 h-4 w-4" />
              {pending ? 'Saving…' : 'Preview & send'}
            </Button>
          </div>
        </>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className={`${workspacePanelCard} overflow-hidden`}>
            <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
              <h3 className={`font-semibold ${workspaceText}`}>
                Email preview
              </h3>
              <p className={`text-xs ${workspaceTextMuted}`}>
                Sample: Alex Taylor · branded with workspace logo and colours
              </p>
            </div>
            <iframe
              title="Campaign preview"
              className="mx-auto h-[560px] bg-white"
              sandbox=""
              style={{
                width: previewWidth === 'mobile' ? 375 : '100%',
                maxWidth: '100%',
              }}
              srcDoc={previewHtml}
            />
          </div>

          <div className={`${workspacePanelCard} space-y-3 p-4`}>
            <h3 className={`font-semibold ${workspaceText}`}>Send</h3>
            <p className={`text-sm ${workspaceTextMuted}`}>
              {subscriberCount.toLocaleString()} subscribed contacts ·{' '}
              {usage.balance.toLocaleString()} send units left
            </p>
            <p className={`text-sm ${workspaceTextMuted}`}>
              From{' '}
              {fromName.trim()
                ? `${fromName.trim()} <${fromEmail || brand.contact_email || 'workspace'}>`
                : fromEmail || brand.contact_email || 'workspace default'}
            </p>
            {document.formLink ? (
              <p className={`text-sm ${workspaceTextMuted}`}>
                Form link: {document.formLink.formName}
                {document.formLink.prefillEmail
                  ? ' (email prefilled per recipient)'
                  : ''}
              </p>
            ) : null}

            {editable ? (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  data-test="campaign-send-test"
                  onClick={() => setSendTestOpen(true)}
                >
                  Send test
                </Button>
                <p className={`text-xs ${workspaceTextMuted}`}>
                  Test emails are free and do not use send units.
                </p>
                <CampaignSendTestDialog
                  open={sendTestOpen}
                  onOpenChange={setSendTestOpen}
                  accountId={accountId}
                  accountSlug={accountSlug}
                  campaignId={campaign.id}
                  onBeforeSend={async () => {
                    await save();
                  }}
                />
                <Button
                  className={workspaceBtnPrimary}
                  disabled={pending}
                  data-test="campaign-send"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await save();
                        const result = await sendCampaignAction({
                          accountId,
                          accountSlug,
                          campaignId: campaign.id,
                        });
                        toast.success(
                          result.remaining > 0
                            ? `Sending… ${result.remaining} left in the queue`
                            : 'Campaign sent',
                        );
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : 'Could not send',
                        );
                      }
                    });
                  }}
                >
                  {pending ? 'Working…' : 'Send now'}
                </Button>
                <div className="flex gap-2">
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    disabled={pending}
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={pending || !scheduledAt}
                    data-test="campaign-schedule"
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await save();
                          await scheduleCampaignAction({
                            accountId,
                            accountSlug,
                            campaignId: campaign.id,
                            scheduledAt: new Date(scheduledAt).toISOString(),
                          });
                          toast.success('Campaign scheduled');
                          router.refresh();
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : 'Could not schedule',
                          );
                        }
                      });
                    }}
                  >
                    Schedule
                  </Button>
                </div>
                {campaign.status === 'scheduled' ? (
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await cancelScheduleCampaignAction({
                            accountId,
                            accountSlug,
                            campaignId: campaign.id,
                          });
                          toast.success('Schedule cancelled');
                          router.refresh();
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : 'Could not cancel',
                          );
                        }
                      });
                    }}
                  >
                    Cancel schedule
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className={`text-sm ${workspaceTextMuted}`}>
                This campaign is {campaign.status}.
                {campaign.scheduledAt
                  ? ` Scheduled for ${new Date(campaign.scheduledAt).toLocaleString()}.`
                  : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {recipients.length > 0 ? (
        <CampaignRecipientLog campaign={campaign} recipients={recipients} />
      ) : null}
    </div>
  );
}
