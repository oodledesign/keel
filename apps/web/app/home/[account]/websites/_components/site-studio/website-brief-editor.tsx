'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Check, Plus, Sparkles, Trash2 } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import {
  BRIEF_SECTIONS,
  type BriefAiSource,
  type BriefSectionKey,
  type WebsiteBrief,
  type WebsiteBriefAiProvenance,
  type WebsiteBriefStackPreference,
  emptyBriefAiProvenance,
  emptyWebsiteBrief,
  newBriefItemId,
  overallBriefCompleteness,
  sectionCompleteness,
} from '~/lib/websites/brief-types';

import {
  confirmWebsiteBriefAi,
  patchWebsiteBrief,
  suggestWebsiteBrief,
} from '../../_lib/server/site-studio-actions';

const STACK_OPTIONS: Array<{
  value: WebsiteBriefStackPreference;
  label: string;
}> = [
  { value: 'undecided', label: 'Undecided' },
  { value: 'webflow', label: 'Webflow (Client-First)' },
  { value: 'astro', label: 'Astro' },
  { value: 'next', label: 'Next.js' },
  { value: 'ozer_sites', label: 'Ozer Sites' },
];

function linesToList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(value: string[]): string {
  return value.join('\n');
}

function AiBadge({
  provenance,
  path,
  onConfirm,
}: {
  provenance: WebsiteBriefAiProvenance;
  path: string;
  onConfirm?: () => void;
}) {
  const entry = provenance.fields[path];
  if (!entry || entry.status === 'human_edited') return null;

  return (
    <span className="inline-flex items-center gap-1">
      <Badge
        variant="outline"
        className="border-[var(--ozer-accent)]/40 text-[10px] font-medium text-[var(--ozer-accent)]"
      >
        AI · {entry.source}
        {entry.status === 'confirmed' ? ' · confirmed' : ''}
      </Badge>
      {entry.status === 'suggested' && onConfirm ? (
        <button
          type="button"
          className="text-[10px] text-[var(--workspace-shell-text-muted)] underline-offset-2 hover:underline"
          onClick={onConfirm}
        >
          Confirm
        </button>
      ) : null}
    </span>
  );
}

function CompletenessDot({ ratio }: { ratio: number }) {
  const colour =
    ratio >= 1
      ? 'bg-emerald-500'
      : ratio >= 0.5
        ? 'bg-[var(--ozer-accent)]'
        : 'bg-[var(--workspace-shell-text)]/25';

  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full', colour)}
      title={`${Math.round(ratio * 100)}% complete`}
    />
  );
}

function Field({
  label,
  hint,
  path,
  provenance,
  onConfirmAi,
  children,
}: {
  label: string;
  hint?: string;
  path?: string;
  provenance: WebsiteBriefAiProvenance;
  onConfirmAi?: (path: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-[var(--workspace-shell-text)]">{label}</Label>
        {path ? (
          <AiBadge
            provenance={provenance}
            path={path}
            onConfirm={
              onConfirmAi && path ? () => onConfirmAi(path) : undefined
            }
          />
        ) : null}
      </div>
      {hint ? (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function WebsiteBriefEditor({
  accountId,
  websiteId,
  initialBrief,
  initialProvenance,
  canEdit,
}: {
  accountId: string;
  websiteId: string;
  initialBrief: WebsiteBrief | null;
  initialProvenance?: WebsiteBriefAiProvenance | null;
  canEdit: boolean;
}) {
  const [brief, setBrief] = useState<WebsiteBrief>(
    initialBrief ?? emptyWebsiteBrief(),
  );
  const [provenance, setProvenance] = useState<WebsiteBriefAiProvenance>(
    initialProvenance ?? emptyBriefAiProvenance(),
  );
  const [source, setSource] = useState<BriefAiSource>('notes');
  const [aiNotes, setAiNotes] = useState('');
  const [aiUrl, setAiUrl] = useState(brief.brand.existingSiteUrl ?? '');
  const [skippedPaths, setSkippedPaths] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  );
  const [isSuggesting, startSuggesting] = useTransition();
  const [isConfirming, startConfirming] = useTransition();

  const pendingPaths = useRef<Set<string>>(new Set());
  const pendingPatch = useRef<Record<string, unknown>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputClass =
    'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]';

  const overall = overallBriefCompleteness(brief);

  function mergePatch(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ) {
    for (const [key, value] of Object.entries(source)) {
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof target[key] === 'object' &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        mergePatch(
          target[key] as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else {
        target[key] = value;
      }
    }
  }

  function queueAutosave(
    next: WebsiteBrief,
    editedPaths: string[],
    patch: Record<string, unknown>,
  ) {
    if (!canEdit) return;
    for (const path of editedPaths) pendingPaths.current.add(path);
    mergePatch(pendingPatch.current, patch);
    setBrief(next);
    setSaveState('saving');

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const paths = Array.from(pendingPaths.current);
      const payload = pendingPatch.current;
      pendingPaths.current.clear();
      pendingPatch.current = {};
      void (async () => {
        try {
          const result = await patchWebsiteBrief({
            accountId,
            websiteId,
            patch: payload,
            editedPaths: paths,
          });
          setProvenance(result.provenance);
          setSaveState('saved');
        } catch (error) {
          setSaveState('idle');
          toast.error(
            error instanceof Error ? error.message : 'Could not save brief',
          );
        }
      })();
    }, 650);
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function confirmPaths(paths: string[]) {
    startConfirming(async () => {
      try {
        const result = await confirmWebsiteBriefAi({
          accountId,
          websiteId,
          paths,
        });
        setProvenance(result.provenance);
        toast.success('AI suggestions confirmed');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not confirm fields',
        );
      }
    });
  }

  function runSuggest(confirmOverwritePaths?: string[]) {
    if (source === 'notes' && !aiNotes.trim()) {
      toast.error('Paste discovery notes first');
      return;
    }
    if (source === 'url' && !aiUrl.trim()) {
      toast.error('Enter a website URL first');
      return;
    }

    startSuggesting(async () => {
      try {
        const result = await suggestWebsiteBrief({
          accountId,
          websiteId,
          source,
          notes: source === 'notes' ? aiNotes.trim() : undefined,
          websiteUrl: source === 'url' ? aiUrl.trim() : undefined,
          confirmOverwritePaths,
        });
        setBrief(result.brief);
        setProvenance(result.provenance);
        setSkippedPaths(result.skippedPaths);
        if (result.skippedPaths.length > 0 && !confirmOverwritePaths?.length) {
          toast.message(
            `Applied ${result.appliedPaths.length} fields — ${result.skippedPaths.length} human fields left unchanged`,
          );
        } else {
          toast.success(
            `Brief suggested (${result.appliedPaths.length} fields) — review AI badges`,
          );
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not draft brief',
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Brief completeness {Math.round(overall * 100)}%
          </p>
          <div className="flex flex-wrap gap-3">
            {BRIEF_SECTIONS.map((section) => {
              const { ratio, filled, total } = sectionCompleteness(
                brief,
                section.key,
              );
              return (
                <span
                  key={section.key}
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--workspace-shell-text-muted)]"
                >
                  <CompletenessDot ratio={ratio} />
                  {section.label} ({filled}/{total})
                </span>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {saveState === 'saving'
            ? 'Saving…'
            : saveState === 'saved'
              ? 'Saved'
              : canEdit
                ? 'Autosaves as you edit'
                : 'View only'}
        </p>
      </div>

      {canEdit ? (
        <div className="space-y-3 rounded-xl border border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent)]/5 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--ozer-accent)]" />
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Suggest from…
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['notes', 'Pasted notes'],
                ['url', 'URL'],
                ['crm', 'CRM fields'],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={source === value ? 'default' : 'outline'}
                onClick={() => setSource(value)}
              >
                {label}
              </Button>
            ))}
          </div>

          {source === 'notes' ? (
            <Textarea
              value={aiNotes}
              onChange={(event) => setAiNotes(event.target.value)}
              rows={4}
              placeholder="Discovery call notes, proposal snippets…"
              className={inputClass}
            />
          ) : null}

          {source === 'url' ? (
            <Input
              value={aiUrl}
              onChange={(event) => setAiUrl(event.target.value)}
              placeholder="https://client-site.com"
              className={`${inputClass} max-w-md`}
            />
          ) : null}

          {source === 'crm' ? (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Pulls name, industry, notes, and website from the linked client
              organisation on this website record.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => runSuggest()}
              disabled={isSuggesting}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {isSuggesting ? 'Suggesting…' : 'Suggest brief'}
            </Button>
            {skippedPaths.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isSuggesting}
                onClick={() => runSuggest(skippedPaths)}
              >
                Overwrite {skippedPaths.length} human fields
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <SectionShell sectionKey="org" brief={brief} title="Organisation">
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Name"
            path="org.name"
            provenance={provenance}
            onConfirmAi={(path) => confirmPaths([path])}
          >
            <Input
              value={brief.org.name}
              readOnly={!canEdit}
              onChange={(event) => {
                const name = event.target.value;
                const next = {
                  ...brief,
                  org: { ...brief.org, name },
                };
                queueAutosave(next, ['org.name'], { org: { name } });
              }}
              className={inputClass}
            />
          </Field>
          <Field
            label="Sector"
            path="org.sector"
            provenance={provenance}
            onConfirmAi={(path) => confirmPaths([path])}
          >
            <Input
              value={brief.org.sector}
              readOnly={!canEdit}
              onChange={(event) => {
                const sector = event.target.value;
                const next = {
                  ...brief,
                  org: { ...brief.org, sector },
                };
                queueAutosave(next, ['org.sector'], { org: { sector } });
              }}
              className={inputClass}
            />
          </Field>
        </div>
        <Field
          label="One-liner"
          path="org.oneLiner"
          provenance={provenance}
          onConfirmAi={(path) => confirmPaths([path])}
        >
          <Textarea
            value={brief.org.oneLiner}
            readOnly={!canEdit}
            rows={2}
            onChange={(event) => {
              const oneLiner = event.target.value;
              const next = {
                ...brief,
                org: { ...brief.org, oneLiner },
              };
              queueAutosave(next, ['org.oneLiner'], { org: { oneLiner } });
            }}
            className={inputClass}
          />
        </Field>
        <Field
          label="Geography"
          hint="Locations / service areas"
          path="org.geography"
          provenance={provenance}
          onConfirmAi={(path) => confirmPaths([path])}
        >
          <Input
            value={brief.org.geography}
            readOnly={!canEdit}
            onChange={(event) => {
              const geography = event.target.value;
              const next = {
                ...brief,
                org: { ...brief.org, geography },
              };
              queueAutosave(next, ['org.geography'], { org: { geography } });
            }}
            className={inputClass}
          />
        </Field>
      </SectionShell>

      <SectionShell sectionKey="brand" brief={brief} title="Brand">
        <Field
          label="Tone"
          hint="One word or phrase per line"
          path="brand.tone"
          provenance={provenance}
          onConfirmAi={(path) => confirmPaths([path])}
        >
          <Textarea
            value={listToLines(brief.brand.tone)}
            readOnly={!canEdit}
            rows={3}
            onChange={(event) => {
              const tone = linesToList(event.target.value);
              const next = {
                ...brief,
                brand: { ...brief.brand, tone },
              };
              queueAutosave(next, ['brand.tone'], { brand: { tone } });
            }}
            className={inputClass}
          />
        </Field>
        <Field
          label="Constraints"
          hint="One rule per line"
          path="brand.constraints"
          provenance={provenance}
          onConfirmAi={(path) => confirmPaths([path])}
        >
          <Textarea
            value={listToLines(brief.brand.constraints)}
            readOnly={!canEdit}
            rows={3}
            onChange={(event) => {
              const constraints = linesToList(event.target.value);
              const next = {
                ...brief,
                brand: { ...brief.brand, constraints },
              };
              queueAutosave(next, ['brand.constraints'], {
                brand: { constraints },
              });
            }}
            className={inputClass}
          />
        </Field>
        <Field
          label="Existing site URL"
          path="brand.existingSiteUrl"
          provenance={provenance}
          onConfirmAi={(path) => confirmPaths([path])}
        >
          <Input
            value={brief.brand.existingSiteUrl ?? ''}
            readOnly={!canEdit}
            onChange={(event) => {
              const existingSiteUrl = event.target.value;
              const next = {
                ...brief,
                brand: { ...brief.brand, existingSiteUrl },
              };
              queueAutosave(next, ['brand.existingSiteUrl'], {
                brand: { existingSiteUrl },
              });
            }}
            className={inputClass}
          />
        </Field>
      </SectionShell>

      <SectionShell sectionKey="offer" brief={brief} title="Offer">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-[var(--workspace-shell-text)]">
                Services
              </Label>
              <AiBadge
                provenance={provenance}
                path="offer.services"
                onConfirm={() => confirmPaths(['offer.services'])}
              />
            </div>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  const services = [
                    ...brief.offer.services,
                    { id: newBriefItemId(), name: '', description: '' },
                  ];
                  const next = {
                    ...brief,
                    offer: { ...brief.offer, services },
                  };
                  queueAutosave(next, ['offer.services'], {
                    offer: { services },
                  });
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add service
              </Button>
            ) : null}
          </div>
          {brief.offer.services.length === 0 ? (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              No services yet.
            </p>
          ) : (
            brief.offer.services.map((service) => (
              <div key={service.id} className="flex items-start gap-2">
                <Input
                  value={service.name}
                  readOnly={!canEdit}
                  placeholder="Service name"
                  className={`${inputClass} max-w-[10rem]`}
                  onChange={(event) => {
                    const services = brief.offer.services.map((item) =>
                      item.id === service.id
                        ? { ...item, name: event.target.value }
                        : item,
                    );
                    const next = {
                      ...brief,
                      offer: { ...brief.offer, services },
                    };
                    queueAutosave(next, ['offer.services'], {
                      offer: { services },
                    });
                  }}
                />
                <Input
                  value={service.description}
                  readOnly={!canEdit}
                  placeholder="Description"
                  className={inputClass}
                  onChange={(event) => {
                    const services = brief.offer.services.map((item) =>
                      item.id === service.id
                        ? { ...item, description: event.target.value }
                        : item,
                    );
                    const next = {
                      ...brief,
                      offer: { ...brief.offer, services },
                    };
                    queueAutosave(next, ['offer.services'], {
                      offer: { services },
                    });
                  }}
                />
                {canEdit ? (
                  <button
                    type="button"
                    className="mt-2.5 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
                    onClick={() => {
                      const services = brief.offer.services.filter(
                        (item) => item.id !== service.id,
                      );
                      const next = {
                        ...brief,
                        offer: { ...brief.offer, services },
                      };
                      queueAutosave(next, ['offer.services'], {
                        offer: { services },
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
        <Field
          label="Primary conversion goals"
          hint="One goal per line"
          path="offer.primaryConversionGoals"
          provenance={provenance}
          onConfirmAi={(path) => confirmPaths([path])}
        >
          <Textarea
            value={listToLines(brief.offer.primaryConversionGoals)}
            readOnly={!canEdit}
            rows={3}
            onChange={(event) => {
              const primaryConversionGoals = linesToList(event.target.value);
              const next = {
                ...brief,
                offer: { ...brief.offer, primaryConversionGoals },
              };
              queueAutosave(next, ['offer.primaryConversionGoals'], {
                offer: { primaryConversionGoals },
              });
            }}
            className={inputClass}
          />
        </Field>
      </SectionShell>

      <SectionShell sectionKey="audience" brief={brief} title="Audience">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-[var(--workspace-shell-text)]">
                Segments
              </Label>
              <AiBadge
                provenance={provenance}
                path="audience.segments"
                onConfirm={() => confirmPaths(['audience.segments'])}
              />
            </div>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  const segments = [
                    ...brief.audience.segments,
                    {
                      id: newBriefItemId(),
                      name: '',
                      jobsToBeDone: '',
                      objections: [],
                    },
                  ];
                  const next = {
                    ...brief,
                    audience: { ...brief.audience, segments },
                  };
                  queueAutosave(next, ['audience.segments'], {
                    audience: { segments },
                  });
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add segment
              </Button>
            ) : null}
          </div>
          {brief.audience.segments.map((segment) => (
            <div
              key={segment.id}
              className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] p-3"
            >
              <div className="flex items-start gap-2">
                <Input
                  value={segment.name}
                  readOnly={!canEdit}
                  placeholder="Segment name"
                  className={inputClass}
                  onChange={(event) => {
                    const segments = brief.audience.segments.map((item) =>
                      item.id === segment.id
                        ? { ...item, name: event.target.value }
                        : item,
                    );
                    const next = {
                      ...brief,
                      audience: { ...brief.audience, segments },
                    };
                    queueAutosave(next, ['audience.segments'], {
                      audience: { segments },
                    });
                  }}
                />
                {canEdit ? (
                  <button
                    type="button"
                    className="mt-2.5 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
                    onClick={() => {
                      const segments = brief.audience.segments.filter(
                        (item) => item.id !== segment.id,
                      );
                      const next = {
                        ...brief,
                        audience: { ...brief.audience, segments },
                      };
                      queueAutosave(next, ['audience.segments'], {
                        audience: { segments },
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <Textarea
                value={segment.jobsToBeDone}
                readOnly={!canEdit}
                rows={2}
                placeholder="Jobs to be done"
                className={inputClass}
                onChange={(event) => {
                  const segments = brief.audience.segments.map((item) =>
                    item.id === segment.id
                      ? { ...item, jobsToBeDone: event.target.value }
                      : item,
                  );
                  const next = {
                    ...brief,
                    audience: { ...brief.audience, segments },
                  };
                  queueAutosave(next, ['audience.segments'], {
                    audience: { segments },
                  });
                }}
              />
              <Textarea
                value={listToLines(segment.objections)}
                readOnly={!canEdit}
                rows={2}
                placeholder="Objections (one per line)"
                className={inputClass}
                onChange={(event) => {
                  const objections = linesToList(event.target.value);
                  const segments = brief.audience.segments.map((item) =>
                    item.id === segment.id ? { ...item, objections } : item,
                  );
                  const next = {
                    ...brief,
                    audience: { ...brief.audience, segments },
                  };
                  queueAutosave(next, ['audience.segments'], {
                    audience: { segments },
                  });
                }}
              />
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        sectionKey="conversation"
        brief={brief}
        title="Conversation"
      >
        <Field
          label="Questions the site must answer"
          hint="One question per line"
          path="conversation.questionsTheSiteMustAnswer"
          provenance={provenance}
          onConfirmAi={(path) => confirmPaths([path])}
        >
          <Textarea
            value={listToLines(brief.conversation.questionsTheSiteMustAnswer)}
            readOnly={!canEdit}
            rows={4}
            onChange={(event) => {
              const questionsTheSiteMustAnswer = linesToList(
                event.target.value,
              );
              const next = {
                ...brief,
                conversation: {
                  ...brief.conversation,
                  questionsTheSiteMustAnswer,
                },
              };
              queueAutosave(next, ['conversation.questionsTheSiteMustAnswer'], {
                conversation: { questionsTheSiteMustAnswer },
              });
            }}
            className={inputClass}
          />
        </Field>
      </SectionShell>

      <SectionShell sectionKey="competitors" brief={brief} title="Competitors">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <AiBadge
              provenance={provenance}
              path="competitors"
              onConfirm={() => confirmPaths(['competitors'])}
            />
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  const competitors = [
                    ...brief.competitors,
                    {
                      id: newBriefItemId(),
                      name: '',
                      url: '',
                      notes: '',
                    },
                  ];
                  const next = { ...brief, competitors };
                  queueAutosave(next, ['competitors'], { competitors });
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add competitor
              </Button>
            ) : null}
          </div>
          {brief.competitors.map((row) => (
            <div
              key={row.id}
              className="grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]"
            >
              <Input
                value={row.name}
                readOnly={!canEdit}
                placeholder="Name"
                className={inputClass}
                onChange={(event) => {
                  const competitors = brief.competitors.map((item) =>
                    item.id === row.id
                      ? { ...item, name: event.target.value }
                      : item,
                  );
                  queueAutosave({ ...brief, competitors }, ['competitors'], {
                    competitors,
                  });
                }}
              />
              <Input
                value={row.url}
                readOnly={!canEdit}
                placeholder="https://…"
                className={inputClass}
                onChange={(event) => {
                  const competitors = brief.competitors.map((item) =>
                    item.id === row.id
                      ? { ...item, url: event.target.value }
                      : item,
                  );
                  queueAutosave({ ...brief, competitors }, ['competitors'], {
                    competitors,
                  });
                }}
              />
              <Input
                value={row.notes}
                readOnly={!canEdit}
                placeholder="Notes"
                className={inputClass}
                onChange={(event) => {
                  const competitors = brief.competitors.map((item) =>
                    item.id === row.id
                      ? { ...item, notes: event.target.value }
                      : item,
                  );
                  queueAutosave({ ...brief, competitors }, ['competitors'], {
                    competitors,
                  });
                }}
              />
              {canEdit ? (
                <button
                  type="button"
                  className="text-[var(--workspace-shell-text-muted)] hover:text-red-400"
                  onClick={() => {
                    const competitors = brief.competitors.filter(
                      (item) => item.id !== row.id,
                    );
                    queueAutosave({ ...brief, competitors }, ['competitors'], {
                      competitors,
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell sectionKey="references" brief={brief} title="References">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Surface up to 3 in UI — more allowed in the brief.
            </p>
            <div className="flex items-center gap-2">
              <AiBadge
                provenance={provenance}
                path="references"
                onConfirm={() => confirmPaths(['references'])}
              />
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const references = [
                      ...brief.references,
                      {
                        id: newBriefItemId(),
                        url: '',
                        whyThisWorks: '',
                      },
                    ];
                    queueAutosave({ ...brief, references }, ['references'], {
                      references,
                    });
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add reference
                </Button>
              ) : null}
            </div>
          </div>
          {brief.references.slice(0, 3).map((ref) => (
            <div key={ref.id} className="flex items-start gap-2">
              <Input
                value={ref.url}
                readOnly={!canEdit}
                placeholder="https://…"
                className={`${inputClass} max-w-xs`}
                onChange={(event) => {
                  const references = brief.references.map((item) =>
                    item.id === ref.id
                      ? { ...item, url: event.target.value }
                      : item,
                  );
                  queueAutosave({ ...brief, references }, ['references'], {
                    references,
                  });
                }}
              />
              <Input
                value={ref.whyThisWorks}
                readOnly={!canEdit}
                placeholder="Why this works…"
                className={inputClass}
                onChange={(event) => {
                  const references = brief.references.map((item) =>
                    item.id === ref.id
                      ? { ...item, whyThisWorks: event.target.value }
                      : item,
                  );
                  queueAutosave({ ...brief, references }, ['references'], {
                    references,
                  });
                }}
              />
              {canEdit ? (
                <button
                  type="button"
                  className="mt-2.5 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
                  onClick={() => {
                    const references = brief.references.filter(
                      (item) => item.id !== ref.id,
                    );
                    queueAutosave({ ...brief, references }, ['references'], {
                      references,
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
          {brief.references.length > 3 ? (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              +{brief.references.length - 3} more stored (not shown)
            </p>
          ) : null}
        </div>
      </SectionShell>

      <SectionShell sectionKey="stack" brief={brief} title="Stack preference">
        <Field
          label="Target stack"
          path="stackPreference"
          provenance={provenance}
          onConfirmAi={(path) => confirmPaths([path])}
        >
          <Select
            value={brief.stackPreference}
            disabled={!canEdit}
            onValueChange={(value) => {
              const stackPreference = value as WebsiteBriefStackPreference;
              queueAutosave(
                { ...brief, stackPreference },
                ['stackPreference'],
                { stackPreference },
              );
            }}
          >
            <SelectTrigger className={`${inputClass} w-56`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STACK_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {isConfirming ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Confirming…
          </p>
        ) : null}
      </SectionShell>
    </div>
  );
}

function SectionShell({
  sectionKey,
  brief,
  title,
  children,
}: {
  sectionKey: BriefSectionKey;
  brief: WebsiteBrief;
  title: string;
  children: React.ReactNode;
}) {
  const { ratio, filled, total } = sectionCompleteness(brief, sectionKey);
  return (
    <section className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          {title}
        </h3>
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--workspace-shell-text-muted)]">
          <CompletenessDot ratio={ratio} />
          {filled}/{total}
          {ratio >= 1 ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : null}
        </span>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
