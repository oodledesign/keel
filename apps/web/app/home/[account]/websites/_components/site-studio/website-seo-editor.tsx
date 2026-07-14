'use client';

import { useMemo, useState, useTransition } from 'react';

import { Check, Plus, Sparkles, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import type { WebsiteBriefStackPreference } from '~/lib/websites/brief-types';
import {
  type WebsiteSeoPageRecord,
  type WebsiteSeoPageSeo,
  type WebsiteSitemapPage,
  emptyWebsiteSeoPageRecord,
  seoCompleteness,
  siteTechnicalChecklist,
} from '~/lib/websites/planning-types';
import {
  SITE_STUDIO_AI_CREDITS,
  siteStudioCreditLabel,
} from '~/lib/websites/site-studio-credits';

import {
  draftWebsiteSeoAnswerBlocks,
  previewWebsiteLlmsTxt,
  proposeWebsiteSeoPage,
  saveWebsiteLlmsTxt,
  saveWebsiteSeoPage,
} from '../../_lib/server/site-studio-actions';

const inputClass =
  'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[var(--workspace-shell-text)]">{label}</Label>
      {hint ? (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  );
}

function completenessTone(score: number) {
  if (score >= 80) return 'text-emerald-700 bg-emerald-500/10';
  if (score >= 40) return 'text-amber-800 bg-amber-500/10';
  return 'text-[var(--workspace-shell-text-muted)] bg-[var(--ozer-surface-canvas)]';
}

export function WebsiteSeoEditor({
  accountId,
  websiteId,
  sitemap,
  initialSeoPages,
  initialLlmsTxt = null,
  canEdit,
  stackPreference = 'undecided',
}: {
  accountId: string;
  websiteId: string;
  sitemap: WebsiteSitemapPage[];
  initialSeoPages: Record<string, WebsiteSeoPageRecord>;
  /** Saved edit-before-export override (Prompt E2). */
  initialLlmsTxt?: string | null;
  canEdit: boolean;
  stackPreference?: WebsiteBriefStackPreference;
}) {
  const [seoPages, setSeoPages] = useState(initialSeoPages);
  const [llmsTxt, setLlmsTxt] = useState(initialLlmsTxt ?? '');
  const [llmsDirty, setLlmsDirty] = useState(false);
  const [activePageId, setActivePageId] = useState<string | null>(
    sitemap[0]?.id ?? null,
  );
  const [proposal, setProposal] = useState<WebsiteSeoPageSeo | null>(null);
  const [answerProposal, setAnswerProposal] = useState<
    WebsiteSeoPageSeo['aeo']['answerBlocks'] | null
  >(null);
  const [isSaving, startSaving] = useTransition();
  const [isProposing, startProposing] = useTransition();
  const [isDraftingAnswers, startDraftingAnswers] = useTransition();
  const [isApproving, startApproving] = useTransition();
  const [isLlmsBusy, startLlmsBusy] = useTransition();

  const activePage = useMemo(
    () => sitemap.find((page) => page.id === activePageId) ?? null,
    [activePageId, sitemap],
  );

  const record = useMemo(() => {
    if (!activePageId || !activePage) {
      return emptyWebsiteSeoPageRecord();
    }
    return (
      seoPages[activePageId] ??
      emptyWebsiteSeoPageRecord(activePageId, activePage.slug)
    );
  }, [activePage, activePageId, seoPages]);

  const seo = record.seo;
  const score = seoCompleteness(seo);
  const techChecklist = siteTechnicalChecklist(stackPreference);

  function setSeo(next: WebsiteSeoPageSeo) {
    if (!activePageId || !activePage) return;
    setSeoPages((current) => ({
      ...current,
      [activePageId]: {
        pageId: activePageId,
        pageSlug: activePage.slug,
        status: current[activePageId]?.status ?? 'draft',
        seo: next,
      },
    }));
  }

  function patchSeo(update: Partial<WebsiteSeoPageSeo>) {
    setSeo({ ...seo, ...update });
  }

  function save(status: 'draft' | 'approved' = record.status) {
    if (!activePageId || !activePage) return;
    startSaving(async () => {
      try {
        const result = await saveWebsiteSeoPage({
          accountId,
          websiteId,
          pageId: activePageId,
          pageSlug: activePage.slug,
          seo,
          status,
        });
        setSeoPages((current) => ({
          ...current,
          [activePageId]: result.record,
        }));
        toast.success(status === 'approved' ? 'Search plan approved' : 'Saved');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not save');
      }
    });
  }

  function propose() {
    if (!activePageId) return;
    startProposing(async () => {
      try {
        const next = await proposeWebsiteSeoPage({
          accountId,
          websiteId,
          pageId: activePageId,
        });
        setProposal(next);
        setAnswerProposal(null);
        toast.success('Search plan ready for review');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not suggest plan',
        );
      }
    });
  }

  function draftAnswers() {
    if (!activePageId) return;
    startDraftingAnswers(async () => {
      try {
        const blocks = await draftWebsiteSeoAnswerBlocks({
          accountId,
          websiteId,
          pageId: activePageId,
        });
        setAnswerProposal(blocks);
        toast.success('Answer blocks ready for review');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not draft answers',
        );
      }
    });
  }

  function applyProposal() {
    if (!proposal) return;
    setSeo(proposal);
    setProposal(null);
    toast.message('Proposal applied — save or approve when ready');
  }

  function applyAnswers() {
    if (!answerProposal) return;
    patchSeo({
      aeo: { ...seo.aeo, answerBlocks: answerProposal },
    });
    setAnswerProposal(null);
    toast.message('Answer blocks applied — save when ready');
  }

  function approve() {
    if (!activePageId) return;
    startApproving(async () => {
      try {
        const result = await saveWebsiteSeoPage({
          accountId,
          websiteId,
          pageId: activePageId,
          pageSlug: activePage?.slug,
          seo,
          status: 'approved',
        });
        setSeoPages((current) => ({
          ...current,
          [activePageId]: result.record,
        }));
        toast.success('Search plan approved');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not approve',
        );
      }
    });
  }

  function regenerateLlms() {
    startLlmsBusy(async () => {
      try {
        const result = await previewWebsiteLlmsTxt({ accountId, websiteId });
        setLlmsTxt(result.llmsTxt);
        setLlmsDirty(true);
        toast.message('Regenerated draft — save to use on export');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not regenerate',
        );
      }
    });
  }

  function saveLlms() {
    startLlmsBusy(async () => {
      try {
        const result = await saveWebsiteLlmsTxt({
          accountId,
          websiteId,
          llmsTxt,
        });
        setLlmsTxt(result.llmsTxt ?? '');
        setLlmsDirty(false);
        toast.success('llms.txt saved for export');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save llms.txt',
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          Site technical checklist
        </p>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Derived from stack preference ({stackPreference}). Not stored per page
          — use when shipping.
        </p>
        <ul className="mt-3 space-y-2">
          {techChecklist.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] px-3 py-2"
            >
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                {item.label}
              </p>
              <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                {item.detail}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              llms.txt (site-level)
            </p>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
              Follows the{' '}
              <a
                href="https://llmstxt.org/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                llmstxt.org
              </a>{' '}
              convention. Edit before export — packs use this override when
              saved.
              {llmsDirty ? ' · Unsaved changes' : ''}
            </p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isLlmsBusy}
                onClick={regenerateLlms}
              >
                Regenerate from contract
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isLlmsBusy || (!llmsTxt.trim() && !llmsDirty)}
                onClick={saveLlms}
              >
                Save for export
              </Button>
            </div>
          ) : null}
        </div>
        <Textarea
          className={cn(inputClass, 'mt-3 min-h-[180px] font-mono text-xs')}
          value={llmsTxt}
          disabled={!canEdit}
          placeholder="Click “Regenerate from contract” to draft llms.txt, then edit and save."
          onChange={(event) => {
            setLlmsTxt(event.target.value);
            setLlmsDirty(true);
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-1">
          {sitemap.map((page) => {
            const pageRecord =
              seoPages[page.id] ??
              emptyWebsiteSeoPageRecord(page.id, page.slug);
            const pageScore = seoCompleteness(pageRecord.seo);
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => {
                  setActivePageId(page.id);
                  setProposal(null);
                  setAnswerProposal(null);
                }}
                className={cn(
                  'flex w-full flex-col gap-1 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors',
                  activePageId === page.id
                    ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
                    : 'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] hover:bg-[var(--workspace-shell-canvas)]',
                )}
              >
                <span className="font-medium text-[var(--workspace-shell-text)]">
                  {page.title}
                </span>
                <span className="flex items-center justify-between gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
                  <span>/{page.slug}</span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 font-medium',
                      completenessTone(pageScore),
                    )}
                  >
                    {pageScore}%{pageRecord.status === 'approved' ? ' · ✓' : ''}
                  </span>
                </span>
              </button>
            );
          })}
          {sitemap.length === 0 ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Add pages in the Sitemap tab first.
            </p>
          ) : null}
        </div>

        {activePage ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--workspace-shell-text)]">
                  {activePage.title}
                </h3>
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  /{activePage.slug} · {record.status} · completeness {score}%
                </p>
              </div>
              {canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isProposing}
                    onClick={propose}
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Suggest search plan
                    <span className="ml-1 text-xs opacity-70">
                      {siteStudioCreditLabel(
                        SITE_STUDIO_AI_CREDITS.seoGenerate,
                      )}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isDraftingAnswers}
                    onClick={draftAnswers}
                  >
                    Draft answer blocks
                    <span className="ml-1 text-xs opacity-70">
                      {siteStudioCreditLabel(
                        SITE_STUDIO_AI_CREDITS.seoAnswerBlocks,
                      )}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => save('draft')}
                  >
                    Save draft
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isApproving || isSaving}
                    onClick={approve}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Approve
                  </Button>
                </div>
              ) : null}
            </div>

            {proposal ? (
              <div className="space-y-2 rounded-lg border border-[var(--ozer-accent)]/40 bg-[var(--ozer-accent-subtle)]/40 p-3">
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  Suggested search plan (preview)
                </p>
                <pre className="max-h-48 overflow-auto rounded border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] p-2 text-xs">
                  {JSON.stringify(proposal, null, 2)}
                </pre>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={applyProposal}>
                    Apply proposal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setProposal(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : null}

            {answerProposal ? (
              <div className="space-y-2 rounded-lg border border-[var(--ozer-accent)]/40 bg-[var(--ozer-accent-subtle)]/40 p-3">
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  Draft answer blocks (preview)
                </p>
                <ul className="space-y-2 text-sm">
                  {answerProposal.map((block, index) => (
                    <li key={`${block.question}-${index}`}>
                      <p className="font-medium">{block.question}</p>
                      <p className="text-[var(--workspace-shell-text-muted)]">
                        {block.draftAnswer}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={applyAnswers}>
                    Apply blocks
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setAnswerProposal(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Primary keyword">
                <Input
                  className={inputClass}
                  value={seo.keywords.primary}
                  disabled={!canEdit}
                  onChange={(event) =>
                    patchSeo({
                      keywords: {
                        ...seo.keywords,
                        primary: event.target.value,
                      },
                    })
                  }
                />
              </Field>
              <Field label="Secondary keywords" hint="Comma-separated">
                <Input
                  className={inputClass}
                  value={seo.keywords.secondary.join(', ')}
                  disabled={!canEdit}
                  onChange={(event) =>
                    patchSeo({
                      keywords: {
                        ...seo.keywords,
                        secondary: event.target.value
                          .split(',')
                          .map((part) => part.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                />
              </Field>
              <Field label="Meta title">
                <Input
                  className={inputClass}
                  value={seo.meta.title}
                  disabled={!canEdit}
                  onChange={(event) =>
                    patchSeo({
                      meta: { ...seo.meta, title: event.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Meta description">
                <Textarea
                  className={inputClass}
                  rows={2}
                  value={seo.meta.description}
                  disabled={!canEdit}
                  onChange={(event) =>
                    patchSeo({
                      meta: { ...seo.meta, description: event.target.value },
                    })
                  }
                />
              </Field>
            </div>

            <Field
              label="Heading outline"
              hint="One heading per line as H1: … / H2: …"
            >
              <Textarea
                className={inputClass}
                rows={5}
                value={seo.headingOutline
                  .map((item) => `H${item.level}: ${item.text}`)
                  .join('\n')}
                disabled={!canEdit}
                onChange={(event) =>
                  patchSeo({
                    headingOutline: event.target.value
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line) => {
                        const match = /^H([1-6])[:\s.-]*(.*)$/i.exec(line);
                        return {
                          level: (match
                            ? Number(match[1])
                            : 2) as WebsiteSeoPageSeo['headingOutline'][number]['level'],
                          text: (match?.[2] ?? line).trim(),
                        };
                      }),
                  })
                }
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Slug rule">
                <Input
                  className={inputClass}
                  value={seo.slugRule}
                  disabled={!canEdit}
                  onChange={(event) =>
                    patchSeo({ slugRule: event.target.value })
                  }
                />
              </Field>
              <Field label="Canonical rule">
                <Input
                  className={inputClass}
                  value={seo.canonicalRule}
                  disabled={!canEdit}
                  onChange={(event) =>
                    patchSeo({ canonicalRule: event.target.value })
                  }
                />
              </Field>
            </div>

            <Field
              label="Internal links"
              hint="One per line: slug — anchor text"
            >
              <Textarea
                className={inputClass}
                rows={3}
                value={seo.internalLinks
                  .map((link) => `${link.toSlug} — ${link.anchorSuggestion}`)
                  .join('\n')}
                disabled={!canEdit}
                onChange={(event) =>
                  patchSeo({
                    internalLinks: event.target.value
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line) => {
                        const [slug, ...rest] = line.split(/[-–—]/);
                        return {
                          toSlug: (slug ?? '')
                            .replace(/^\//, '')
                            .trim()
                            .toLowerCase(),
                          anchorSuggestion: rest.join('—').trim(),
                        };
                      }),
                  })
                }
              />
            </Field>

            <Field label="Schema types" hint="Comma-separated schema.org types">
              <Input
                className={inputClass}
                value={seo.schemaTypes.join(', ')}
                disabled={!canEdit}
                onChange={(event) =>
                  patchSeo({
                    schemaTypes: event.target.value
                      .split(',')
                      .map((part) => part.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="OG image plan">
                <Input
                  className={inputClass}
                  value={seo.technical.ogImagePlan}
                  disabled={!canEdit}
                  onChange={(event) =>
                    patchSeo({
                      technical: {
                        ...seo.technical,
                        ogImagePlan: event.target.value,
                      },
                    })
                  }
                />
              </Field>
              <Field label="Indexable">
                <label className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text)]">
                  <input
                    type="checkbox"
                    checked={seo.technical.indexable}
                    disabled={!canEdit}
                    onChange={(event) =>
                      patchSeo({
                        technical: {
                          ...seo.technical,
                          indexable: event.target.checked,
                        },
                      })
                    }
                  />
                  Allow indexing
                </label>
              </Field>
            </div>

            <div className="space-y-3 rounded-lg border border-[color:var(--workspace-shell-border)] p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  GEO
                </p>
                <label className="flex items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
                  <input
                    type="checkbox"
                    checked={seo.geo.isLocationPage}
                    disabled={!canEdit}
                    onChange={(event) =>
                      patchSeo({
                        geo: {
                          ...seo.geo,
                          isLocationPage: event.target.checked,
                        },
                      })
                    }
                  />
                  Location page
                </label>
              </div>
              <Field label="NAP">
                <Textarea
                  className={inputClass}
                  rows={2}
                  value={seo.geo.nap}
                  disabled={!canEdit}
                  onChange={(event) =>
                    patchSeo({ geo: { ...seo.geo, nap: event.target.value } })
                  }
                />
              </Field>
              <Field label="Service area" hint="Comma-separated">
                <Input
                  className={inputClass}
                  value={seo.geo.serviceArea.join(', ')}
                  disabled={!canEdit}
                  onChange={(event) =>
                    patchSeo({
                      geo: {
                        ...seo.geo,
                        serviceArea: event.target.value
                          .split(',')
                          .map((part) => part.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                />
              </Field>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  AEO answer blocks
                </p>
                {canEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      patchSeo({
                        aeo: {
                          ...seo.aeo,
                          answerBlocks: [
                            ...seo.aeo.answerBlocks,
                            { question: '', draftAnswer: '' },
                          ],
                        },
                      })
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add
                  </Button>
                ) : null}
              </div>
              {seo.aeo.answerBlocks.map((block, index) => (
                <div
                  key={`answer-${index}`}
                  className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] p-3"
                >
                  <div className="flex justify-between gap-2">
                    <Input
                      className={inputClass}
                      placeholder="Question"
                      value={block.question}
                      disabled={!canEdit}
                      onChange={(event) => {
                        const next = [...seo.aeo.answerBlocks];
                        next[index] = {
                          ...block,
                          question: event.target.value,
                        };
                        patchSeo({ aeo: { ...seo.aeo, answerBlocks: next } });
                      }}
                    />
                    {canEdit ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          patchSeo({
                            aeo: {
                              ...seo.aeo,
                              answerBlocks: seo.aeo.answerBlocks.filter(
                                (_, i) => i !== index,
                              ),
                            },
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  <Textarea
                    className={inputClass}
                    rows={3}
                    placeholder="Draft answer"
                    value={block.draftAnswer}
                    disabled={!canEdit}
                    onChange={(event) => {
                      const next = [...seo.aeo.answerBlocks];
                      next[index] = {
                        ...block,
                        draftAnswer: event.target.value,
                      };
                      patchSeo({ aeo: { ...seo.aeo, answerBlocks: next } });
                    }}
                  />
                </div>
              ))}
              <Field label="Entity notes">
                <Textarea
                  className={inputClass}
                  rows={2}
                  value={seo.aeo.entityNotes}
                  disabled={!canEdit}
                  onChange={(event) =>
                    patchSeo({
                      aeo: { ...seo.aeo, entityNotes: event.target.value },
                    })
                  }
                />
              </Field>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
