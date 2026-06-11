'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { ArrowLeft, Send } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Progress } from '@kit/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import type {
  CustomContactListRow,
  EmailCampaignRow,
  EmailRecipientList,
} from '~/lib/admin-email/recipient-lists';
import {
  MARKETING_CAMPAIGN_TEMPLATES,
  getMarketingCampaignTemplate,
  isEditableHtmlTemplate,
  type MarketingCampaignTemplateId,
} from '~/lib/email-templates/marketing-campaign-templates';
import { renderMarketingTemplate } from '~/lib/email-templates/marketing-templates';

import { saveCampaignDraft } from '../_lib/server/email-marketing.actions';

const RECIPIENT_LISTS: Array<{ value: EmailRecipientList; label: string }> = [
  { value: 'all_users', label: 'All users' },
  { value: 'tier_1', label: 'Tier 1' },
  { value: 'tier_2', label: 'Tier 2' },
  { value: 'tier_3', label: 'Tier 3' },
  { value: 'business_owners', label: 'Business owners' },
  { value: 'inactive', label: 'Inactive users' },
  { value: 'beta_users', label: 'Beta users' },
  { value: 'no_subscription', label: 'No subscription' },
  { value: 'beta_contacts', label: 'Beta contacts' },
  { value: 'pre_signup_contacts', label: 'Pre-signup contacts' },
  { value: 'contact_list', label: 'Custom contact list' },
  { value: 'manual', label: 'Manual addresses' },
  { value: 'custom', label: 'Custom users' },
];

type ComposerTemplateId =
  | MarketingCampaignTemplateId
  | 'announcement'
  | 'newsletter'
  | 'blank';

function resolveInitialTemplateId(
  campaign?: EmailCampaignRow | null,
): ComposerTemplateId {
  if (campaign?.template_id && isEditableHtmlTemplate(campaign.template_id)) {
    return campaign.template_id;
  }

  if (campaign?.html_body?.trim()) {
    return 'blank';
  }

  if (
    campaign?.template_id === 'announcement' ||
    campaign?.template_id === 'newsletter'
  ) {
    return campaign.template_id;
  }

  return 'announcement';
}

export function CampaignComposer({
  campaign,
  customUsers,
  customContactLists = [],
  superAdminEmail,
  defaultRecipientList,
  defaultContactListId,
}: {
  campaign?: EmailCampaignRow | null;
  customUsers: Array<{ id: string; email: string }>;
  customContactLists?: CustomContactListRow[];
  superAdminEmail: string;
  defaultRecipientList?: EmailRecipientList;
  defaultContactListId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [campaignId, setCampaignId] = useState(campaign?.id ?? null);
  const [title, setTitle] = useState(campaign?.title ?? '');
  const [subject, setSubject] = useState(campaign?.subject ?? '');
  const [previewText, setPreviewText] = useState(campaign?.preview_text ?? '');
  const [recipientList, setRecipientList] = useState<EmailRecipientList>(
    campaign?.recipient_list ?? defaultRecipientList ?? 'all_users',
  );
  const [contactListId, setContactListId] = useState(
    campaign?.contact_list_id ?? defaultContactListId ?? '',
  );
  const [manualEmails, setManualEmails] = useState(
    campaign?.manual_recipient_emails?.join('\n') ?? '',
  );
  const [customRecipientIds, setCustomRecipientIds] = useState<string[]>(
    campaign?.custom_recipient_ids ?? [],
  );
  const [templateId, setTemplateId] = useState<ComposerTemplateId>(
    resolveInitialTemplateId(campaign),
  );
  const [heading, setHeading] = useState('Build better with Tradeways');
  const [subheading, setSubheading] = useState(previewText);
  const [body, setBody] = useState('Add your campaign message here.');
  const [ctaLabel, setCtaLabel] = useState('Open Tradeways');
  const [ctaUrl, setCtaUrl] = useState(
    process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.replace(/\/+$/, '') ??
      'https://www.tradeways.co.uk',
  );
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [features, setFeatures] = useState([
    { heading: 'Feature one', body: 'Short update or news item.' },
    { heading: 'Feature two', body: 'Short update or news item.' },
    { heading: 'Feature three', body: 'Short update or news item.' },
  ]);
  const [blankHtml, setBlankHtml] = useState(campaign?.html_body ?? '');
  const [plainTextBody, setPlainTextBody] = useState(campaign?.plain_text_body ?? '');
  const [htmlTemplateSeed, setHtmlTemplateSeed] = useState<string | null>(
    campaign?.template_id && isEditableHtmlTemplate(campaign.template_id)
      ? campaign.template_id
      : null,
  );
  const [testEmail, setTestEmail] = useState(superAdminEmail);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [progress, setProgress] = useState<{
    status: string;
    sent_count: number;
    total_recipients: number;
  } | null>(null);

  const html = useMemo(() => {
    if (templateId === 'blank' || isEditableHtmlTemplate(templateId)) {
      return blankHtml;
    }

    return renderMarketingTemplate(templateId, {
      heading,
      subheading,
      body,
      cta_label: ctaLabel,
      cta_url: ctaUrl,
      hero_image_url: heroImageUrl,
      features,
    });
  }, [
    blankHtml,
    body,
    ctaLabel,
    ctaUrl,
    features,
    heading,
    heroImageUrl,
    subheading,
    templateId,
  ]);

  useEffect(() => {
    const template = getMarketingCampaignTemplate(templateId);
    if (!template) {
      return;
    }

    if (htmlTemplateSeed === templateId) {
      return;
    }

    const hasSavedHtml =
      campaign?.template_id === templateId && Boolean(campaign.html_body?.trim());

    setBlankHtml(hasSavedHtml ? campaign!.html_body! : template.render());

    if (!campaignId) {
      setSubject(template.defaultSubject);
      setPreviewText(template.defaultPreviewText);
      setTitle(template.defaultTitle);

      if (template.suggestedRecipientList) {
        setRecipientList(template.suggestedRecipientList);
      }
    }

    setHtmlTemplateSeed(templateId);
  }, [campaign, campaignId, htmlTemplateSeed, templateId]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const response = await fetch('/api/admin/email/estimate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipientList,
          contactListId: recipientList === 'contact_list' ? contactListId : null,
          manualRecipientEmails: manualEmails,
          customRecipientIds,
        }),
        signal: controller.signal,
      }).catch(() => null);
      if (response?.ok) {
        const data = (await response.json()) as { count: number };
        setEstimate(data.count);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [contactListId, customRecipientIds, manualEmails, recipientList]);

  const save = async () => {
    const id = await saveCampaignDraft({
      id: campaignId,
      title,
      subject,
      previewText,
      htmlBody: html,
      plainTextBody,
      templateId: isEditableHtmlTemplate(templateId) || templateId === 'blank'
        ? templateId === 'blank'
          ? null
          : templateId
        : templateId,
      recipientList,
      contactListId: recipientList === 'contact_list' ? contactListId : null,
      manualRecipientEmails: manualEmails,
      customRecipientIds,
    });
    setCampaignId(id);
    return id;
  };

  const handleSend = () => {
    startTransition(async () => {
      try {
        const id = await save();
        setProgress({ status: 'sending', sent_count: 0, total_recipients: estimate ?? 0 });

        const sendPromise = fetch('/api/admin/email/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ campaignId: id }),
        });

        const poll = window.setInterval(async () => {
          const response = await fetch(`/api/admin/email/progress?campaignId=${id}`);
          if (response.ok) {
            const data = await response.json();
            setProgress(data);
            if (data.status === 'sent' || data.status === 'cancelled') {
              window.clearInterval(poll);
            }
          }
        }, 1000);

        const response = await sendPromise;
        window.clearInterval(poll);
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? 'Failed to send campaign');
        }
        const data = await response.json();
        setProgress({ status: 'sent', sent_count: data.sent, total_recipients: data.total });
        toast.success('Campaign sent');
        router.push(`/admin/email-marketing/${id}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to send campaign');
      }
    });
  };

  const handleTest = (prefix: 'Test' | 'Copy' = 'Test') => {
    const to = testEmail.trim();
    if (!to || !/\S+@\S+\.\S+/.test(to)) {
      toast.error('Enter a valid email address for the test copy');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/email/test', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            to,
            subject,
            html,
            text: plainTextBody,
            prefix,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? 'Failed to send test email');
        }

        toast.success(prefix === 'Copy' ? `Copy sent to ${to}` : `Test sent to ${to}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to send test email');
      }
    });
  };

  const progressValue = progress?.total_recipients
    ? (progress.sent_count / progress.total_recipients) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Button
            variant="ghost"
            className="mb-2 text-zinc-400 hover:text-white"
            onClick={() => router.push('/admin/email-marketing')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-white">Campaign composer</h1>
          <p className="text-zinc-400">Create branded HTML campaigns and send them via SES.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button
            variant="outline"
            disabled={isPending}
            className="border-white/10"
            onClick={() =>
              startTransition(async () => {
                await save();
                toast.success('Draft saved');
              })
            }
          >
            Save draft
          </Button>
          <div className="min-w-[220px] space-y-2">
            <Label className="text-zinc-400">Send a copy to</Label>
            <Input
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              placeholder="you@example.com"
              className="border-white/10 bg-black/20 text-white"
            />
          </div>
          <Button
            variant="outline"
            disabled={isPending || !testEmail.trim()}
            className="border-white/10"
            onClick={() => handleTest('Test')}
          >
            Send test
          </Button>
          <Button
            variant="outline"
            disabled={isPending || !testEmail.trim()}
            className="border-white/10"
            onClick={() => handleTest('Copy')}
          >
            Send a copy
          </Button>
          <Button disabled={isPending} className="bg-[#57C87F] text-[#09111F] hover:bg-[#97D9AA]" onClick={handleSend}>
            <Send className="mr-2 h-4 w-4" />
            Send campaign
          </Button>
        </div>
      </div>

      {progress ? (
        <Card className="border-white/10 bg-[var(--workspace-shell-panel)]">
          <CardContent className="space-y-3 p-4">
            <div className="flex justify-between text-sm text-zinc-300">
              <span>Status: {progress.status}</span>
              <span>
                {progress.sent_count}/{progress.total_recipients} sent
              </span>
            </div>
            <Progress value={progressValue} className="bg-white/10" />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
        <Card className="border-white/10 bg-[var(--workspace-shell-panel)]">
          <CardHeader>
            <CardTitle className="text-white">Campaign settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <InputField label="Title (internal)" value={title} onChange={setTitle} />
            <InputField label="Subject line" value={subject} onChange={setSubject} />
            <InputField label="Preview text" value={previewText} onChange={setPreviewText} />

            <div className="space-y-2">
              <Label className="text-white">Recipient list</Label>
              <Select
                value={recipientList}
                onValueChange={(value) => {
                  setRecipientList(value as EmailRecipientList);
                  if (value !== 'contact_list') {
                    setContactListId('');
                  } else if (!contactListId && customContactLists[0]) {
                    setContactListId(customContactLists[0].id);
                  }
                }}
              >
                <SelectTrigger className="border-white/10 bg-black/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECIPIENT_LISTS.map((list) => (
                    <SelectItem key={list.value} value={list.value}>
                      {list.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {recipientList === 'contact_list' ? (
                <Select
                  value={contactListId || '__none__'}
                  onValueChange={(value) =>
                    setContactListId(value === '__none__' ? '' : value)
                  }
                >
                  <SelectTrigger className="border-white/10 bg-black/20 text-white">
                    <SelectValue placeholder="Choose a list" />
                  </SelectTrigger>
                  <SelectContent>
                    {customContactLists.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        No custom lists yet
                      </SelectItem>
                    ) : (
                      customContactLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              ) : null}
              <p className="text-sm text-zinc-500">
                Estimated recipients: {estimate === null ? 'Calculating…' : estimate}
              </p>
            </div>

            {recipientList === 'manual' ? (
              <div className="space-y-2">
                <Label className="text-white">Manual addresses</Label>
                <Textarea
                  value={manualEmails}
                  onChange={(event) => setManualEmails(event.target.value)}
                  className="min-h-32 border-white/10 bg-black/20 text-white"
                  placeholder="name@example.com, another@example.com"
                />
              </div>
            ) : null}

            {recipientList === 'custom' ? (
              <div className="space-y-2">
                <Label className="text-white">Custom users</Label>
                <div className="max-h-48 space-y-2 overflow-auto rounded-xl border border-white/10 p-3">
                  {customUsers.map((user) => (
                    <label key={user.id} className="flex items-center gap-2 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={customRecipientIds.includes(user.id)}
                        onChange={(event) =>
                          setCustomRecipientIds((current) =>
                            event.target.checked
                              ? [...current, user.id]
                              : current.filter((id) => id !== user.id),
                          )
                        }
                      />
                      {user.email}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label className="text-white">Template</Label>
              <Select
                value={templateId}
                onValueChange={(value) => {
                  setTemplateId(value as ComposerTemplateId);
                  setHtmlTemplateSeed(null);
                }}
              >
                <SelectTrigger className="border-white/10 bg-black/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="announcement">Announcement</SelectItem>
                  <SelectItem value="newsletter">Newsletter</SelectItem>
                  {Object.entries(MARKETING_CAMPAIGN_TEMPLATES).map(([id, template]) => (
                    <SelectItem key={id} value={id}>
                      {template.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="blank">Blank HTML</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {templateId === 'blank' || isEditableHtmlTemplate(templateId) ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-white">HTML body</Label>
                  {isEditableHtmlTemplate(templateId) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-white/10"
                      onClick={() => {
                        const template = getMarketingCampaignTemplate(templateId);
                        if (!template) return;
                        setBlankHtml(template.render());
                        toast.success('Template reset to default HTML');
                      }}
                    >
                      Reset to default
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-zinc-400">
                  Spark-safe table layout with inline styles. Copy-ready files also live in{' '}
                  <code className="rounded bg-black/30 px-1 py-0.5">public/email-previews/</code>.
                </p>
                {isEditableHtmlTemplate(templateId) ? (
                  <p className="text-xs text-zinc-500">
                    {getMarketingCampaignTemplate(templateId)?.description}
                  </p>
                ) : null}
                <Textarea
                  value={blankHtml}
                  onChange={(event) => setBlankHtml(event.target.value)}
                  className="min-h-64 border-white/10 bg-black/20 font-mono text-white"
                />
              </div>
            ) : (
              <TemplateFields
                templateId={templateId}
                heading={heading}
                setHeading={setHeading}
                subheading={subheading}
                setSubheading={setSubheading}
                body={body}
                setBody={setBody}
                ctaLabel={ctaLabel}
                setCtaLabel={setCtaLabel}
                ctaUrl={ctaUrl}
                setCtaUrl={setCtaUrl}
                heroImageUrl={heroImageUrl}
                setHeroImageUrl={setHeroImageUrl}
                features={features}
                setFeatures={setFeatures}
              />
            )}

            <div className="space-y-2">
              <Label className="text-white">Plain text fallback (optional)</Label>
              <Textarea
                value={plainTextBody}
                onChange={(event) => setPlainTextBody(event.target.value)}
                className="min-h-28 border-white/10 bg-black/20 text-white"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[var(--workspace-shell-panel)]">
          <CardHeader>
            <CardTitle className="text-white">Live preview</CardTitle>
          </CardHeader>
          <CardContent>
            <iframe
              title="Campaign preview"
              srcDoc={html}
              className="h-[720px] w-full rounded-2xl border border-white/10 bg-white"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-white">{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-white/10 bg-black/20 text-white"
      />
    </div>
  );
}

function TemplateFields(props: {
  templateId: string;
  heading: string;
  setHeading: (value: string) => void;
  subheading: string;
  setSubheading: (value: string) => void;
  body: string;
  setBody: (value: string) => void;
  ctaLabel: string;
  setCtaLabel: (value: string) => void;
  ctaUrl: string;
  setCtaUrl: (value: string) => void;
  heroImageUrl: string;
  setHeroImageUrl: (value: string) => void;
  features: Array<{ heading: string; body: string }>;
  setFeatures: (value: Array<{ heading: string; body: string }>) => void;
}) {
  return (
    <div className="space-y-4">
      <InputField label="Heading" value={props.heading} onChange={props.setHeading} />
      <InputField label="Subheading" value={props.subheading} onChange={props.setSubheading} />
      {props.templateId === 'announcement' ? (
        <InputField label="Hero image URL (optional)" value={props.heroImageUrl} onChange={props.setHeroImageUrl} />
      ) : null}
      <div className="space-y-2">
        <Label className="text-white">Body</Label>
        <Textarea value={props.body} onChange={(event) => props.setBody(event.target.value)} className="min-h-40 border-white/10 bg-black/20 text-white" />
      </div>
      {props.templateId === 'newsletter' ? (
        <div className="space-y-3">
          <Label className="text-white">Feature/news blocks</Label>
          {props.features.map((feature, index) => (
            <div key={index} className="space-y-2 rounded-xl border border-white/10 p-3">
              <Input value={feature.heading} onChange={(event) => {
                const next = [...props.features];
                next[index] = { ...feature, heading: event.target.value };
                props.setFeatures(next);
              }} className="border-white/10 bg-black/20 text-white" placeholder={`Feature ${index + 1} heading`} />
              <Textarea value={feature.body} onChange={(event) => {
                const next = [...props.features];
                next[index] = { ...feature, body: event.target.value };
                props.setFeatures(next);
              }} className="border-white/10 bg-black/20 text-white" placeholder="Short paragraph" />
            </div>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <InputField label="CTA label" value={props.ctaLabel} onChange={props.setCtaLabel} />
        <InputField label="CTA URL" value={props.ctaUrl} onChange={props.setCtaUrl} />
      </div>
    </div>
  );
}
