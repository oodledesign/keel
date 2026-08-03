'use client';

import { useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2, Pencil, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import {
  addVoicePasteSourceAction,
  addVoiceUploadTextAction,
  deleteVoiceSourceAction,
  deleteVoiceThemeAction,
  rebuildVoiceProfileAction,
  setLearnFromSentEmailAction,
  setVoiceSourceIncludedAction,
  updateVoiceGuidanceAction,
  upsertVoiceThemeAction,
} from '~/lib/voice/voice.actions';
import type { VoiceProfilePageData } from '~/lib/voice/voice.types';

type Scope =
  | { kind: 'personal' }
  | { kind: 'brand'; accountId: string; accountSlug: string };

type Props = {
  scope: Scope;
  initial: VoiceProfilePageData;
  canEdit: boolean;
};

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 sm:p-5';

export function ToneOfVoiceSettingsClient({ scope, initial, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [guidance, setGuidance] = useState(initial.profile.guidanceText ?? '');
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [themeTitle, setThemeTitle] = useState('');
  const [themeDescription, setThemeDescription] = useState('');
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editExamples, setEditExamples] = useState('');

  const statusLabel = useMemo(() => {
    if (initial.profile.status === 'updating') return 'Rebuilding…';
    if (initial.profile.status === 'ready') return 'Ready';
    return 'Draft';
  }, [initial.profile.status]);

  function run(label: string, fn: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(label);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Something went wrong',
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className={panelClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Tone of voice
            </h2>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
              Add samples of how you write. Rebuild to distill themes used for
              email drafts
              {scope.kind === 'brand' ? ' and proposals' : ''}.
            </p>
            <p className="mt-2 text-xs text-[var(--workspace-shell-text-muted)]">
              Status: {statusLabel}
              {initial.profile.lastDistilledAt
                ? ` · Last rebuilt ${new Date(initial.profile.lastDistilledAt).toLocaleString()}`
                : ''}
            </p>
          </div>
          {canEdit ? (
            <Button
              type="button"
              disabled={pending}
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              onClick={() =>
                run('Voice rebuilt', () => rebuildVoiceProfileAction({ scope }))
              }
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Rebuild voice
            </Button>
          ) : null}
        </div>
      </section>

      <section className={panelClass}>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Themes
        </h3>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Editable cards describing how writing should sound. Distilled themes
          appear after rebuild; you can delete or add your own.
        </p>
        <ul className="mt-4 space-y-3">
          {initial.themes.length === 0 ? (
            <li className="text-sm text-[var(--workspace-shell-text-muted)]">
              No themes yet. Add samples and rebuild, or create a theme
              manually.
            </li>
          ) : (
            initial.themes.map((theme) => (
              <li
                key={theme.id}
                className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-3"
              >
                {editingThemeId === theme.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      placeholder="Theme title"
                    />
                    <Textarea
                      value={editDescription}
                      onChange={(event) =>
                        setEditDescription(event.target.value)
                      }
                      rows={2}
                      placeholder="Description"
                    />
                    <Input
                      value={editExamples}
                      onChange={(event) => setEditExamples(event.target.value)}
                      placeholder="Examples (comma-separated)"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending || !editTitle.trim()}
                        onClick={() =>
                          run('Theme updated', async () => {
                            await upsertVoiceThemeAction({
                              scope,
                              themeId: theme.id,
                              title: editTitle,
                              description: editDescription,
                              examples: editExamples
                                .split(',')
                                .map((item) => item.trim())
                                .filter(Boolean)
                                .slice(0, 3),
                            });
                            setEditingThemeId(null);
                          })
                        }
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => setEditingThemeId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                        {theme.title}
                        <span className="ml-2 text-[10px] font-normal tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                          {theme.source}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
                        {theme.description}
                      </p>
                      {theme.examples.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {theme.examples.map((example) => (
                            <li
                              key={example}
                              className="text-xs text-[var(--workspace-shell-text-muted)] italic"
                            >
                              “{example}”
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    {canEdit ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          className="text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                          aria-label="Edit theme"
                          onClick={() => {
                            setEditingThemeId(theme.id);
                            setEditTitle(theme.title);
                            setEditDescription(theme.description);
                            setEditExamples(theme.examples.join(', '));
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className="text-[var(--workspace-shell-text-muted)] hover:text-red-500"
                          aria-label="Delete theme"
                          onClick={() =>
                            run('Theme removed', () =>
                              deleteVoiceThemeAction({
                                scope,
                                profileId: initial.profile.id,
                                themeId: theme.id,
                              }),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            ))
          )}
        </ul>

        {canEdit ? (
          <div className="mt-4 space-y-2 border-t border-[color:var(--workspace-shell-border)] pt-4">
            <Label htmlFor="theme-title">Add manual theme</Label>
            <Input
              id="theme-title"
              value={themeTitle}
              onChange={(event) => setThemeTitle(event.target.value)}
              placeholder="e.g. Warm but direct openings"
            />
            <Textarea
              value={themeDescription}
              onChange={(event) => setThemeDescription(event.target.value)}
              placeholder="Describe the theme…"
              rows={2}
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending || !themeTitle.trim()}
              onClick={() =>
                run('Theme added', async () => {
                  await upsertVoiceThemeAction({
                    scope,
                    title: themeTitle,
                    description: themeDescription,
                    examples: [],
                  });
                  setThemeTitle('');
                  setThemeDescription('');
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add theme
            </Button>
          </div>
        ) : null}
      </section>

      <section className={panelClass}>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Guidance
        </h3>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Distilled instructions injected into AI drafts. Edit freely after a
          rebuild.
        </p>
        <Textarea
          className="mt-3"
          rows={6}
          value={guidance}
          disabled={!canEdit || pending}
          onChange={(event) => setGuidance(event.target.value)}
          placeholder="How should AI writing sound in your voice?"
        />
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            disabled={pending}
            onClick={() =>
              run('Guidance saved', () =>
                updateVoiceGuidanceAction({
                  scope,
                  guidanceText: guidance,
                }),
              )
            }
          >
            Save guidance
          </Button>
        ) : null}
      </section>

      <section className={panelClass}>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Sources
        </h3>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Paste writing or upload a .txt / .md file. Sources feed rebuilds; they
          are not dumped into every prompt.
        </p>

        {scope.kind === 'personal' && canEdit ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-3">
            <div>
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                Learn from my sent emails
              </p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Samples up to 25 recent sent messages when enabled or rebuilt.
              </p>
            </div>
            <Switch
              checked={initial.profile.learnFromSentEmail}
              disabled={pending}
              onCheckedChange={(enabled) =>
                run(
                  enabled
                    ? 'Sent-email learning enabled'
                    : 'Sent-email learning disabled',
                  () => setLearnFromSentEmailAction({ scope, enabled }),
                )
              }
            />
          </div>
        ) : null}

        {canEdit ? (
          <div className="mt-4 space-y-2">
            <Input
              value={pasteTitle}
              onChange={(event) => setPasteTitle(event.target.value)}
              placeholder="Sample title (optional)"
            />
            <Textarea
              rows={5}
              value={pasteContent}
              onChange={(event) => setPasteContent(event.target.value)}
              placeholder="Paste an email, proposal paragraph, or other writing…"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending || pasteContent.trim().length < 20}
                onClick={() =>
                  run('Sample added', async () => {
                    await addVoicePasteSourceAction({
                      scope,
                      title: pasteTitle || 'Pasted sample',
                      content: pasteContent,
                    });
                    setPasteTitle('');
                    setPasteContent('');
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add paste
              </Button>
              <label className="inline-flex cursor-pointer items-center">
                <input
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="sr-only"
                  disabled={pending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const text = String(reader.result ?? '');
                      run('File added', () =>
                        addVoiceUploadTextAction({
                          scope,
                          title: file.name,
                          content: text,
                        }),
                      );
                    };
                    reader.onerror = () =>
                      toast.error('Could not read that file');
                    reader.readAsText(file);
                  }}
                />
                <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 text-sm font-medium text-[var(--workspace-shell-text)]">
                  <Upload className="h-4 w-4" />
                  Upload .txt / .md
                </span>
              </label>
            </div>
          </div>
        ) : null}

        <ul className="mt-4 divide-y divide-[color:var(--workspace-shell-border)]">
          {initial.sources.length === 0 ? (
            <li className="py-3 text-sm text-[var(--workspace-shell-text-muted)]">
              No samples yet.
            </li>
          ) : (
            initial.sources.map((source) => (
              <li
                key={source.id}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                    {source.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                    {source.type} · {source.contentText.length} chars
                    {source.included ? '' : ' · excluded'}
                  </p>
                </div>
                {canEdit ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      checked={source.included}
                      disabled={pending}
                      onCheckedChange={(included) =>
                        run(
                          included ? 'Sample included' : 'Sample excluded',
                          () =>
                            setVoiceSourceIncludedAction({
                              scope,
                              profileId: initial.profile.id,
                              sourceId: source.id,
                              included,
                            }),
                        )
                      }
                    />
                    <button
                      type="button"
                      disabled={pending}
                      className="text-[var(--workspace-shell-text-muted)] hover:text-red-500"
                      aria-label="Delete sample"
                      onClick={() =>
                        run('Sample deleted', () =>
                          deleteVoiceSourceAction({
                            scope,
                            profileId: initial.profile.id,
                            sourceId: source.id,
                          }),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
