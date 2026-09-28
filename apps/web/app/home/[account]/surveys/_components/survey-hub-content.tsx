'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  Check,
  FileText,
  ImagePlus,
  Loader2,
  type LucideIcon,
  MapPin,
  Mic,
  NotebookPen,
  Plus,
  Zap,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { Textarea } from '@kit/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { SurveyPhotosPanel } from '~/home/[account]/proposals/_components/survey-photos-panel';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import type {
  SurveyEpcRecord,
  SurveyPropertyLookup,
} from '~/lib/building-surveyor/epc/types';
import type { SurveyFloodRecord } from '~/lib/building-surveyor/flood/types';
import type { SurveyTemplateRecord } from '~/lib/building-surveyor/survey-template';
import {
  type SurveyLevel,
  surveyTypeForLevel,
} from '~/lib/building-surveyor/survey-types';
import {
  workspaceLinkAccent,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type {
  SurveyObservation,
  SurveyPhotoShare,
  SurveyTranscriptSummary,
} from '../_lib/schema/survey-capture.schema';
import {
  addSurveyTranscriptAction,
  setSurveyPhotoShareAction,
  updateSurveyTypeAction,
} from '../_lib/server/survey-capture-actions';
import type { SurveyDealOption } from '../_lib/server/survey-deal-options.loader';
import { surveyClientName, surveyPath } from '../_lib/survey-display';
import { SurveyClientLinkCard } from './survey-client-link-card';
import { SurveyLevelSetting } from './survey-level-setting';
import { SurveyPropertyPanel } from './survey-property-panel';

type ClientInfo = {
  id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
};

type DealInfo = {
  id: string;
  name?: string | null;
  contact_name?: string | null;
  company_name?: string | null;
  stage?: string | null;
};

const OVERVIEW_TABS = ['property', 'setup', 'visits', 'photos'] as const;
type OverviewTab = (typeof OVERVIEW_TABS)[number];

function isOverviewTab(value: string | null): value is OverviewTab {
  return OVERVIEW_TABS.includes(value as OverviewTab);
}

const tabTriggerClass =
  'gap-2 text-[var(--workspace-shell-text)]/60 data-[state=active]:border data-[state=active]:border-[var(--ozer-accent)]/30 data-[state=active]:bg-[var(--ozer-accent-subtle)] data-[state=active]:text-[var(--workspace-shell-accent-text)]';

export function SurveyHubContent({
  accountSlug,
  accountId,
  canEdit,
  proposal,
  observations,
  transcripts: initialTranscripts,
  photoShare: initialPhotoShare,
  styleExampleCount,
  templates = [],
  surveyTemplateId: initialTemplateId,
  attachedEpc: initialAttachedEpc,
  propertyLookup,
  epcConfigured,
  flood,
  surveyLevel: initialSurveyLevel,
  deals,
  canEditClient,
}: {
  accountSlug: string;
  accountId: string;
  canEdit: boolean;
  proposal: {
    id: string;
    title?: string | null;
    content_html?: string | null;
    recipient_name?: string | null;
    client_id?: string | null;
    client?: ClientInfo | null;
    deal?: DealInfo | null;
  };
  observations: SurveyObservation[];
  transcripts: SurveyTranscriptSummary[];
  photoShare: SurveyPhotoShare;
  styleExampleCount: number;
  templates?: SurveyTemplateRecord[];
  surveyTemplateId?: string | null;
  attachedEpc: SurveyEpcRecord | null;
  propertyLookup: SurveyPropertyLookup;
  epcConfigured: boolean;
  flood: SurveyFloodRecord;
  surveyLevel: SurveyLevel;
  deals: SurveyDealOption[];
  canEditClient: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<OverviewTab>(
    isOverviewTab(initialTab) ? initialTab : 'property',
  );
  const [lookup, setLookup] = useState(propertyLookup);
  const [attachedEpc, setAttachedEpc] = useState(initialAttachedEpc);
  const [transcripts, setTranscripts] = useState(initialTranscripts);
  const noteCount = observations.length;
  const noteSectionCount = new Set(observations.map((item) => item.sectionKey))
    .size;
  const [surveyLevel, setSurveyLevel] =
    useState<SurveyLevel>(initialSurveyLevel);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [pasting, setPasting] = useState(false);
  const [, startTransition] = useTransition();
  const [photoShare, setPhotoShare] = useState(initialPhotoShare);
  const [surveyTemplateId, setSurveyTemplateId] = useState(
    initialTemplateId ?? '',
  );
  const [shareCopied, setShareCopied] = useState(false);

  const contentHref = surveyPath(
    pathsConfig.app.accountSurveyReview,
    accountSlug,
    proposal.id,
  );
  const builderHref = surveyPath(
    pathsConfig.app.accountSurveyEdit,
    accountSlug,
    proposal.id,
  );
  const styleHref = pathsConfig.app.accountSurveyStyleSettings.replace(
    '[account]',
    accountSlug,
  );
  const photoSharePath =
    photoShare.enabled && photoShare.token
      ? pathsConfig.app.surveyPhotoShare.replace('[token]', photoShare.token)
      : null;
  const hasDraft = Boolean(
    proposal.content_html?.replace(/<[^>]+>/g, '').trim(),
  );
  const clientName = surveyClientName(proposal);

  const changeTab = (next: string) => {
    if (!isOverviewTab(next)) return;
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    if (next === 'property') params.delete('tab');
    else params.set('tab', next);
    const qs = params.toString();
    window.history.replaceState(
      null,
      '',
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  };

  const handlePaste = async () => {
    if (!canEdit) return;
    const content = pasteContent.trim();
    if (content.length < 20) {
      toast.error('Paste a longer site visit transcript so it can be grouped.');
      return;
    }

    setPasting(true);
    try {
      const result = await addSurveyTranscriptAction({
        accountId,
        accountSlug,
        proposalId: proposal.id,
        title: pasteTitle.trim() || 'Site visit',
        content,
      });
      setTranscripts((prev) => [result.transcript, ...prev]);
      setPasteContent('');
      setPasteTitle('');
      const count = result.observations.length;
      const noun = `note${count === 1 ? '' : 's'}`;
      toast.success(
        result.groupingSource === 'ai'
          ? `Added ${count} ${noun} to Content review.`
          : `Added ${count} ${noun} with keyword routing${
              result.groupingFallbackReason
                ? ` (${result.groupingFallbackReason})`
                : ''
            }.`,
        {
          action: {
            label: 'Review',
            onClick: () => router.push(contentHref),
          },
        },
      );
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPasting(false);
    }
  };

  const readiness: Array<{
    key: string;
    label: string;
    done: boolean;
    icon: LucideIcon;
    onClick?: () => void;
    href?: string;
  }> = [
    {
      key: 'address',
      label: lookup.address ? 'Address added' : 'Add the address',
      done: Boolean(lookup.address || lookup.postcode),
      icon: MapPin,
      onClick: () => changeTab('property'),
    },
    {
      key: 'epc',
      label: attachedEpc ? 'EPC attached' : 'Pull the EPC',
      done: Boolean(attachedEpc),
      icon: Zap,
      onClick: () => changeTab('property'),
    },
    {
      key: 'notes',
      label:
        noteCount > 0
          ? `${noteCount} note${noteCount === 1 ? '' : 's'} in ${noteSectionCount} section${noteSectionCount === 1 ? '' : 's'}`
          : 'Add site notes',
      done: noteCount > 0,
      icon: NotebookPen,
      href: contentHref,
    },
    {
      key: 'draft',
      label: hasDraft ? 'Draft generated' : 'Generate the draft',
      done: hasDraft,
      icon: FileText,
      href: builderHref,
    },
  ];
  const doneCount = readiness.filter((item) => item.done).length;

  return (
    <div className="flex w-full flex-col gap-5">
      <Tabs value={tab} onValueChange={changeTab}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <TabsList className="h-11 w-full justify-start overflow-x-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/80 p-1 text-xs sm:w-auto">
            <TabsTrigger value="property" className={tabTriggerClass}>
              Property
            </TabsTrigger>
            <TabsTrigger value="setup" className={tabTriggerClass}>
              Details
            </TabsTrigger>
            <TabsTrigger value="visits" className={tabTriggerClass}>
              Site visits
              {transcripts.length > 0 ? ` (${transcripts.length})` : ''}
            </TabsTrigger>
            <TabsTrigger value="photos" className={tabTriggerClass}>
              Photos and sharing
            </TabsTrigger>
          </TabsList>

          <TooltipProvider delayDuration={150}>
            <div
              className="flex items-center gap-3"
              data-test="survey-readiness"
            >
              <span className={`text-xs font-medium ${workspaceTextMuted}`}>
                Progress {doneCount}/{readiness.length}
              </span>
              <ol className="flex items-center gap-1.5" aria-label="Progress">
                {readiness.map((item) => {
                  const Icon = item.icon;
                  const className = cn(
                    'relative flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-150 hover:scale-105 active:scale-95',
                    item.done
                      ? 'border-[var(--ozer-accent)]/40 bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]'
                      : 'border-dashed border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] opacity-60 hover:opacity-100',
                  );
                  const content = (
                    <>
                      <Icon className="h-3.5 w-3.5" />
                      {item.done ? (
                        <span className="absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--ozer-accent)] text-[var(--ozer-white)]">
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                      ) : null}
                      <span className="sr-only">{item.label}</span>
                    </>
                  );
                  return (
                    <li key={item.key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {item.href ? (
                            <Link
                              href={item.href}
                              className={className}
                              data-test={`survey-readiness-${item.key}`}
                            >
                              {content}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              className={className}
                              onClick={item.onClick}
                              data-test={`survey-readiness-${item.key}`}
                            >
                              {content}
                            </button>
                          )}
                        </TooltipTrigger>
                        <TooltipContent>{item.label}</TooltipContent>
                      </Tooltip>
                    </li>
                  );
                })}
              </ol>
            </div>
          </TooltipProvider>
        </div>

        <TabsContent value="property" className="mt-0">
          <SurveyPropertyPanel
            accountId={accountId}
            accountSlug={accountSlug}
            proposalId={proposal.id}
            proposalTitle={proposal.title ?? null}
            canEdit={canEdit}
            epcConfigured={epcConfigured}
            lookup={lookup}
            onLookupChange={setLookup}
            attachedEpc={attachedEpc}
            onAttachedEpcChange={setAttachedEpc}
            flood={flood}
          />
        </TabsContent>

        <TabsContent value="setup" className="mt-0">
          <div className="grid gap-5 xl:grid-cols-2">
            <Card className={workspacePanelCard}>
              <CardContent className="space-y-5 p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                  Report settings
                </h3>
                <SurveyLevelSetting
                  accountId={accountId}
                  accountSlug={accountSlug}
                  proposalId={proposal.id}
                  canEdit={canEdit}
                  surveyLevel={surveyLevel}
                  onChange={setSurveyLevel}
                />

                {templates.length > 0 ? (
                  <div className="space-y-2">
                    <Label className={`text-xs ${workspaceTextMuted}`}>
                      Report template
                    </Label>
                    {canEdit ? (
                      <select
                        value={surveyTemplateId}
                        onChange={(event) => {
                          const next = event.target.value || null;
                          setSurveyTemplateId(next ?? '');
                          startTransition(async () => {
                            try {
                              await updateSurveyTypeAction({
                                accountId,
                                accountSlug,
                                proposalId: proposal.id,
                                surveyType: surveyTypeForLevel(surveyLevel),
                                surveyTemplateId: next,
                              });
                              toast.success('Template assigned');
                            } catch (error) {
                              toast.error(getErrorMessage(error));
                            }
                          });
                        }}
                        className="w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-3 py-2 text-sm"
                      >
                        <option value="">Standard RICS template</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm">
                        {templates.find((item) => item.id === surveyTemplateId)
                          ?.name ?? 'Standard RICS template'}
                      </p>
                    )}
                  </div>
                ) : null}

                <div className="space-y-1">
                  <p className={`text-xs ${workspaceTextMuted}`}>
                    Writing style
                  </p>
                  <Link
                    href={styleHref}
                    className={`text-sm ${workspaceLinkAccent}`}
                  >
                    {styleExampleCount > 0
                      ? `Based on ${styleExampleCount} past report${
                          styleExampleCount === 1 ? '' : 's'
                        }`
                      : 'Add past reports so drafts match your style'}
                  </Link>
                </div>
              </CardContent>
            </Card>

            <SurveyClientLinkCard
              accountId={accountId}
              accountSlug={accountSlug}
              proposalId={proposal.id}
              canEdit={canEditClient}
              clientId={proposal.client_id ?? null}
              clientName={clientName}
              deal={proposal.deal ?? null}
              deals={deals}
            />
          </div>
        </TabsContent>

        <TabsContent value="visits" className="mt-0">
          <Card className={workspacePanelCard}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                    Site visits
                  </h3>
                  <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
                    Paste the transcript from your site visit. We save it
                    against this survey and sort it into notes by RICS section,
                    ready for Content review.
                  </p>
                </div>
                <Mic className={`h-4 w-4 shrink-0 ${workspaceTextMuted}`} />
              </div>

              <div className="mt-4 grid gap-6 xl:grid-cols-2">
                {canEdit ? (
                  <div className="space-y-3">
                    <Input
                      value={pasteTitle}
                      onChange={(event) => setPasteTitle(event.target.value)}
                      placeholder="Visit title (optional)"
                    />
                    <Textarea
                      value={pasteContent}
                      onChange={(event) => setPasteContent(event.target.value)}
                      placeholder="Paste the site visit transcript here…"
                      className="min-h-40"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={pasting}
                      onClick={() => void handlePaste()}
                    >
                      {pasting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Add visit
                    </Button>
                  </div>
                ) : null}

                {transcripts.length === 0 ? (
                  <p className={`text-sm ${workspaceTextMuted}`}>
                    No site visits on this survey yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
                    {transcripts.map((item) => (
                      <li key={item.id} className="py-3 first:pt-0">
                        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                          {item.title}
                        </p>
                        <p
                          className={`mt-1 line-clamp-3 text-xs ${workspaceTextMuted}`}
                        >
                          {item.content}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos" className="mt-0">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <SurveyPhotosPanel
              accountId={accountId}
              accountSlug={accountSlug}
              proposalId={proposal.id}
              clientId={proposal.client_id}
              canEdit={canEdit}
              layout="library"
            />

            <Card className={`${workspacePanelCard} h-fit`}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                      Client photo share
                    </h3>
                    <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
                      A link to the full archive. Not embedded in the PDF.
                    </p>
                  </div>
                  {canEdit ? (
                    <Switch
                      checked={photoShare.enabled}
                      onCheckedChange={(enabled) => {
                        startTransition(async () => {
                          try {
                            const next = await setSurveyPhotoShareAction({
                              accountId,
                              accountSlug,
                              proposalId: proposal.id,
                              enabled,
                            });
                            setPhotoShare(next);
                          } catch (error) {
                            toast.error(getErrorMessage(error));
                          }
                        });
                      }}
                    />
                  ) : null}
                </div>
                {photoShare.enabled && photoSharePath ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-md bg-[var(--workspace-shell-sidebar-accent)] px-2 py-1.5 text-xs">
                      {photoSharePath}
                    </code>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const url = `${window.location.origin}${photoSharePath}`;
                        await navigator.clipboard.writeText(url);
                        setShareCopied(true);
                        window.setTimeout(() => setShareCopied(false), 2000);
                      }}
                    >
                      {shareCopied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button type="button" size="sm" variant="outline" asChild>
                      <a href={photoSharePath} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 flex items-start gap-2">
                    <ImagePlus
                      className={`mt-0.5 h-4 w-4 ${workspaceTextMuted}`}
                    />
                    <p className={`text-xs ${workspaceTextMuted}`}>
                      Turn on sharing when the client should have the full photo
                      set. Curated photos stay in the report draft.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
