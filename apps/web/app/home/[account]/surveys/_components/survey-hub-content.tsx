'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import { FileText, ImagePlus, Loader2, Mic, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import pathsConfig from '~/config/paths.config';
import { SurveyPhotosPanel } from '~/home/[account]/proposals/_components/survey-photos-panel';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import { documentEditPath } from '~/lib/building-surveyor/document-kind';
import type {
  SurveyEpcRecord,
  SurveyPropertyLookup,
} from '~/lib/building-surveyor/epc/types';
import type { SurveyFloodRecord } from '~/lib/building-surveyor/flood/types';
import {
  hubSectionDisplayLabel,
  hubSectionsForLevel,
  surveySectionByKey,
} from '~/lib/building-surveyor/survey-section-catalogue';
import type { SurveyTemplateRecord } from '~/lib/building-surveyor/survey-template';
import {
  type SurveyLevel,
  normalizeSurveyLevel,
  surveyLevelFromType,
  surveyTypeForLevel,
} from '~/lib/building-surveyor/survey-types';
import {
  workspaceBtnPrimaryMd,
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
  createSurveyObservationAction,
  generateSurveyDraftAction,
  setSurveyPhotoShareAction,
  updateSurveyTypeAction,
} from '../_lib/server/survey-capture-actions';
import { GroupedObservationCard } from './grouped-observation-card';
import { SurveyPhrasePanel } from './survey-phrase-panel';
import { SurveyPrepPanel } from './survey-prep-panel';
import { SurveyPublishPanel } from './survey-publish-panel';
import { SurveySectionHeadingIcon } from './survey-section-heading-icon';

type ClientInfo = {
  id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  postcode?: string | null;
};

type DealInfo = {
  id: string;
  name?: string | null;
  contact_name?: string | null;
  company_name?: string | null;
  stage?: string | null;
};

export function SurveyHubContent({
  accountSlug,
  accountId,
  accountName,
  senderName,
  canEdit,
  proposal,
  observations: initialObservations,
  transcripts: initialTranscripts,
  photoShare: initialPhotoShare,
  styleExampleCount,
  templates = [],
  surveyTemplateId: initialTemplateId,
  attachedEpc,
  propertyLookup,
  epcConfigured,
  flood,
  surveyLevel: initialSurveyLevel,
}: {
  accountSlug: string;
  accountId: string;
  accountName: string;
  senderName: string;
  canEdit: boolean;
  proposal: {
    id: string;
    title?: string | null;
    status: string;
    content_html?: string | null;
    recipient_name?: string | null;
    client_id?: string | null;
    deal_id?: string | null;
    survey_type?: string | null;
    client?: ClientInfo | null;
    deal?: DealInfo | null;
    updated_at?: string | null;
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
}) {
  const [observations, setObservations] = useState(initialObservations);
  const [transcripts, setTranscripts] = useState(initialTranscripts);
  const [surveyLevel, setSurveyLevel] = useState<SurveyLevel>(
    initialSurveyLevel ??
      surveyLevelFromType(proposal.survey_type) ??
      normalizeSurveyLevel(proposal.survey_type),
  );
  const visibleSections = useMemo(
    () => hubSectionsForLevel(surveyLevel),
    [surveyLevel],
  );
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [newSectionKey, setNewSectionKey] = useState('overall_opinion');
  const [newBody, setNewBody] = useState('');
  const selectedSectionKey = visibleSections.some(
    (section) => section.key === newSectionKey,
  )
    ? newSectionKey
    : (visibleSections[0]?.key ?? 'overall_opinion');
  const [pending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [photoShare, setPhotoShare] = useState(initialPhotoShare);
  const [surveyTemplateId, setSurveyTemplateId] = useState(
    initialTemplateId ?? '',
  );
  const [shareCopied, setShareCopied] = useState(false);

  const editHref = documentEditPath(accountSlug, proposal.id, 'survey_report');
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
  const clientName =
    proposal.client?.display_name?.trim() ||
    [proposal.client?.first_name, proposal.client?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    proposal.recipient_name?.trim() ||
    proposal.deal?.contact_name?.trim() ||
    'No client yet';
  const propertyLabel =
    proposal.deal?.company_name?.trim() ||
    proposal.deal?.name?.trim() ||
    proposal.client?.company_name?.trim() ||
    proposal.title?.trim() ||
    'Property not set';
  const grouped = useMemo(() => {
    const byKey = new Map<string, SurveyObservation[]>();
    for (const observation of observations) {
      const list = byKey.get(observation.sectionKey) ?? [];
      list.push(observation);
      byKey.set(observation.sectionKey, list);
    }
    const known = visibleSections.map((section) => ({
      section,
      items: byKey.get(section.key) ?? [],
    }));
    const knownKeys = new Set(visibleSections.map((section) => section.key));
    const hidden = [...byKey.entries()]
      .filter(([key]) => !knownKeys.has(key))
      .map(([key, items]) => ({
        section: {
          key,
          heading: key.replaceAll('_', ' '),
          group: 'Hidden at this level',
          letter: '',
          optional: true,
        },
        items,
      }));
    return [...known, ...hidden].filter((group) => group.items.length > 0);
  }, [observations, visibleSections]);

  const handlePaste = async () => {
    if (!canEdit) return;
    const content = pasteContent.trim();
    if (content.length < 20) {
      toast.error('Paste a longer site meeting so it can be grouped.');
      return;
    }

    setPasting(true);
    try {
      const result = await addSurveyTranscriptAction({
        accountId,
        accountSlug,
        proposalId: proposal.id,
        title: pasteTitle.trim() || 'Site meeting',
        content,
      });
      setTranscripts((prev) => [result.transcript, ...prev]);
      setObservations((prev) => [...prev, ...result.observations]);
      setPasteContent('');
      setPasteTitle('');
      toast.success(
        result.groupingSource === 'ai'
          ? `Grouped ${result.observations.length} observation${
              result.observations.length === 1 ? '' : 's'
            } by content.`
          : `Grouped ${result.observations.length} observation${
              result.observations.length === 1 ? '' : 's'
            } with keyword routing${
              result.groupingFallbackReason
                ? ` (${result.groupingFallbackReason})`
                : ''
            }.`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPasting(false);
    }
  };

  const handleGenerate = async () => {
    if (!canEdit) return;
    setGenerating(true);
    try {
      const result = await generateSurveyDraftAction({
        accountId,
        accountSlug,
        proposalId: proposal.id,
        accountName,
        surveyorName: senderName,
      });
      toast.success(
        result.source === 'ai'
          ? 'Draft report updated from grouped observations.'
          : (result.fallbackReason ??
              'Drafted from keyword routing because the AI path was unavailable.'),
        {
          action: {
            label: 'Open editor',
            onClick: () => {
              window.location.href = editHref;
            },
          },
        },
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p
            className={`text-xs tracking-wide uppercase ${workspaceTextMuted}`}
          >
            Survey hub
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--workspace-shell-text)]">
            {proposal.title?.trim() || 'Building survey'}
          </h2>
          <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
            {clientName} · {propertyLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/home/${accountSlug}/surveys/${proposal.id}/review`}>
              Desk review
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={editHref}>
              <FileText className="mr-2 h-4 w-4" />
              {hasDraft ? 'Open draft' : 'Open report editor'}
            </Link>
          </Button>
          {canEdit ? (
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={
                generating ||
                (observations.length === 0 && transcripts.length === 0)
              }
              onClick={() => void handleGenerate()}
            >
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Generate draft
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,1fr)]">
        <div className="space-y-5">
          <SurveyPrepPanel
            accountId={accountId}
            accountSlug={accountSlug}
            proposalId={proposal.id}
            canEdit={canEdit}
            epcConfigured={epcConfigured}
            lookup={propertyLookup}
            attachedEpc={attachedEpc}
            flood={flood}
            surveyLevel={surveyLevel}
            onSurveyLevelChange={setSurveyLevel}
            clientName={clientName}
            enquiryStage={proposal.deal?.stage?.replaceAll('_', ' ') || '—'}
            propertyLabel={propertyLabel}
          />

          {templates.length > 0 ? (
            <section className={`${workspacePanelCard} p-4 sm:p-5`}>
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
                  className="mt-1 w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-3 py-2 text-sm"
                >
                  <option value="">System template for type</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 text-sm">
                  {templates.find((item) => item.id === surveyTemplateId)
                    ?.name ?? 'System template'}
                </p>
              )}
              <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
                Assign a cloned RICS shell, or keep the system template for this
                survey level.
              </p>
            </section>
          ) : null}

          <section className={`${workspacePanelCard} p-4 sm:p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                  Site meetings
                </h3>
                <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
                  Paste a walkthrough meeting. We store it against this survey
                  and group sentences by content into editable observations.
                  Keyword routing is used if AI is unavailable.
                </p>
              </div>
              <Mic className={`h-4 w-4 shrink-0 ${workspaceTextMuted}`} />
            </div>

            {canEdit ? (
              <div className="mt-4 space-y-3">
                <Input
                  value={pasteTitle}
                  onChange={(event) => setPasteTitle(event.target.value)}
                  placeholder="Meeting title (optional)"
                />
                <Textarea
                  value={pasteContent}
                  onChange={(event) => setPasteContent(event.target.value)}
                  placeholder="Paste the site meeting here…"
                  className="min-h-36"
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
                  Add meeting and group
                </Button>
              </div>
            ) : null}

            {transcripts.length === 0 ? (
              <p className={`mt-4 text-sm ${workspaceTextMuted}`}>
                No meetings on this survey yet.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[color:var(--workspace-shell-border)]">
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
          </section>

          <section className={`${workspacePanelCard} p-4 sm:p-5`}>
            <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Grouped observations
            </h3>
            <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
              Reassign a note if the grouping missed the section. These feed the
              draft report.
            </p>

            {canEdit ? (
              <div className="mt-4 space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] p-3">
                <Label className="text-xs">Add observation</Label>
                <select
                  value={selectedSectionKey}
                  onChange={(event) => setNewSectionKey(event.target.value)}
                  className="w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-2 py-1.5 text-sm"
                >
                  {visibleSections.map((section) => (
                    <option key={section.key} value={section.key}>
                      {hubSectionDisplayLabel(section)}
                    </option>
                  ))}
                </select>
                <Textarea
                  value={newBody}
                  onChange={(event) => setNewBody(event.target.value)}
                  placeholder="Observation…"
                  className="min-h-20"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending || !newBody.trim()}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        const created = await createSurveyObservationAction({
                          accountId,
                          accountSlug,
                          proposalId: proposal.id,
                          sectionKey: selectedSectionKey,
                          body: newBody.trim(),
                        });
                        setObservations((prev) => [...prev, created]);
                        setNewBody('');
                      } catch (error) {
                        toast.error(getErrorMessage(error));
                      }
                    });
                  }}
                >
                  Add observation
                </Button>
              </div>
            ) : null}

            {grouped.length === 0 ? (
              <p className={`mt-4 text-sm ${workspaceTextMuted}`}>
                Observations will appear here after you add a meeting.
              </p>
            ) : (
              <div className="mt-4 space-y-5">
                {grouped.map(({ section, items }) => {
                  return (
                    <div key={section.key}>
                      <h4 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                        <SurveySectionHeadingIcon
                          sectionKey={section.key}
                          className="h-3.5 w-3.5 shrink-0"
                        />
                        {hubSectionDisplayLabel(section)}
                      </h4>
                      <ul className="mt-2 space-y-3">
                        {items.map((item) => (
                          <GroupedObservationCard
                            key={item.id}
                            item={item}
                            accountId={accountId}
                            accountSlug={accountSlug}
                            proposalId={proposal.id}
                            canEdit={canEdit}
                            sections={visibleSections}
                            onChange={(next) =>
                              setObservations((prev) =>
                                prev.map((row) =>
                                  row.id === next.id ? next : row,
                                ),
                              )
                            }
                            onDelete={(id) =>
                              setObservations((prev) =>
                                prev.filter((row) => row.id !== id),
                              )
                            }
                            onInsertAsBlock={(body, defaultRating) => {
                              startTransition(async () => {
                                try {
                                  const created =
                                    await createSurveyObservationAction({
                                      accountId,
                                      accountSlug,
                                      proposalId: proposal.id,
                                      sectionKey: item.sectionKey,
                                      body,
                                      conditionRating: defaultRating
                                        ? (defaultRating as SurveyObservation['conditionRating'])
                                        : undefined,
                                    });
                                  setObservations((prev) => [...prev, created]);
                                  toast.success(
                                    'Phrase added as a new observation',
                                  );
                                } catch (error) {
                                  toast.error(getErrorMessage(error));
                                }
                              });
                            }}
                          />
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <SurveyPublishPanel
            accountId={accountId}
            accountSlug={accountSlug}
            proposalId={proposal.id}
            canEdit={canEdit}
            hasDraft={hasDraft}
          />

          <SurveyPhrasePanel
            accountId={accountId}
            sectionKey={selectedSectionKey}
            ricsCode={surveySectionByKey(selectedSectionKey)?.ricsCode}
            canEdit={canEdit}
            onInsert={(body, defaultRating) => {
              startTransition(async () => {
                try {
                  const created = await createSurveyObservationAction({
                    accountId,
                    accountSlug,
                    proposalId: proposal.id,
                    sectionKey: selectedSectionKey,
                    body,
                    conditionRating: defaultRating
                      ? (defaultRating as SurveyObservation['conditionRating'])
                      : undefined,
                  });
                  setObservations((prev) => [...prev, created]);
                  toast.success('Phrase added as a new observation');
                } catch (error) {
                  toast.error(getErrorMessage(error));
                }
              });
            }}
          />

          <section className={`${workspacePanelCard} p-4 sm:p-5`}>
            <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Draft report
            </h3>
            <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
              Status: {proposal.status}
              {hasDraft ? ' · draft content saved' : ' · no draft yet'}
            </p>
            <p className="mt-3 text-sm">
              <Link href={editHref} className={workspaceLinkAccent}>
                {hasDraft
                  ? 'Review and edit the report'
                  : 'Open the blank report editor'}
              </Link>
            </p>
            <p className={`mt-2 text-xs ${workspaceTextMuted}`}>
              Generation uses grouped observations first, then raw meetings,
              curated photo captions, and the firm&apos;s uploaded report style.
            </p>
            <p className="mt-3 text-sm">
              <Link href={styleHref} className={workspaceLinkAccent}>
                {styleExampleCount > 0
                  ? `Survey style · ${styleExampleCount} past report${
                      styleExampleCount === 1 ? '' : 's'
                    }`
                  : 'Add past reports for style'}
              </Link>
            </p>
          </section>

          <SurveyPhotosPanel
            accountId={accountId}
            accountSlug={accountSlug}
            proposalId={proposal.id}
            clientId={proposal.client_id}
            canEdit={canEdit}
            layout="library"
          />

          <section className={`${workspacePanelCard} p-4 sm:p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                  Client photo share
                </h3>
                <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
                  A link to the full archive — not embedded in the PDF.
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
                <ImagePlus className={`mt-0.5 h-4 w-4 ${workspaceTextMuted}`} />
                <p className={`text-xs ${workspaceTextMuted}`}>
                  Turn on sharing when the client should have the full photo
                  set. Curated photos stay in the report draft.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
