'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import { ChevronLeft, Loader2, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type { TaskAssignmentOption } from '~/home/(user)/_lib/actions/task-actions';

import {
  commitWorkspaceExtractedTasks,
  extractWorkspaceTasksFromTranscript,
  type ExtractedTaskReviewRow,
} from '../_lib/server/task-ai-actions';

type Props = {
  accountId: string;
  accountSlug: string;
  assignmentOptions: TaskAssignmentOption[];
  embedded?: boolean;
  initialRawText?: string;
  defaultClientId?: string | null;
  successRedirectHref?: string;
};

function assignValue(projectId: string | null, clientId: string | null): string {
  if (projectId) return `p:${projectId}`;
  if (clientId) return `c:${clientId}`;
  return '__none__';
}

function parseAssignValue(v: string): { projectId: string | null; clientId: string | null } {
  if (v.startsWith('p:')) return { projectId: v.slice(2), clientId: null };
  if (v.startsWith('c:')) return { projectId: null, clientId: v.slice(2) };
  return { projectId: null, clientId: null };
}

/** If AI only matched the first group, reuse that project/client for later parents. */
function fillMissingParentAssignments(
  rows: ExtractedTaskReviewRow[],
): ExtractedTaskReviewRow[] {
  const donor = rows.find((r) => r.projectId || r.clientId);
  if (!donor) return rows;
  return rows.map((r) => {
    if (r.projectId || r.clientId) return r;
    return {
      ...r,
      projectId: donor.projectId,
      clientId: donor.clientId,
    };
  });
}

function applyDefaultClient(
  rows: ExtractedTaskReviewRow[],
  defaultClientId: string | null | undefined,
): ExtractedTaskReviewRow[] {
  if (!defaultClientId) return rows;
  return rows.map((row) =>
    row.clientId || row.projectId
      ? row
      : { ...row, clientId: defaultClientId },
  );
}

export function ExtractWorkspaceTasksClient({
  accountId,
  accountSlug,
  assignmentOptions,
  embedded = false,
  initialRawText = '',
  defaultClientId = null,
  successRedirectHref,
}: Props) {
  const [rawText, setRawText] = useState(initialRawText);
  const [rows, setRows] = useState<ExtractedTaskReviewRow[] | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setRawText(initialRawText);
  }, [initialRawText]);

  const tasksPath =
    successRedirectHref ??
    pathsConfig.app.accountTasks.replace('[account]', accountSlug);

  const projects = useMemo(
    () => assignmentOptions.filter((o) => o.type === 'project'),
    [assignmentOptions],
  );
  const clients = useMemo(
    () => assignmentOptions.filter((o) => o.type === 'client'),
    [assignmentOptions],
  );

  const extract = () => {
    setExtracting(true);
    startTransition(async () => {
      try {
        const result = await extractWorkspaceTasksFromTranscript({
          accountId,
          rawText,
        });
        setRows(
          applyDefaultClient(
            fillMissingParentAssignments(result.rows),
            defaultClientId,
          ),
        );
        if (result.rows.length === 0) {
          toast.message('No tasks extracted', {
            description: 'Try a longer email or transcript with clear action items.',
          });
        } else {
          toast.success(`Extracted ${result.rows.length} task group(s)`);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Extraction failed');
      } finally {
        setExtracting(false);
      }
    });
  };

  const commit = () => {
    if (!rows?.length) return;
    const prepared = fillMissingParentAssignments(rows);
    const missingLink = prepared.filter(
      (r) => r.included && !r.projectId && !r.clientId,
    );
    if (missingLink.length > 0) {
      toast.error('Choose a project or client for each included task', {
        description:
          'Use the “Link to” field on every task group, or set one row and we will reuse it.',
      });
      return;
    }
    setCommitting(true);
    startTransition(async () => {
      try {
        const result = await commitWorkspaceExtractedTasks({
          accountId,
          accountSlug,
          items: prepared.map((r) => ({
            id: r.id,
            title: r.title,
            notes: r.notes,
            dueDate: r.dueDate,
            priority: r.priority,
            projectId: r.projectId,
            clientId: r.clientId,
            included: r.included,
            subtasks: r.subtasks.map((s) => ({
              id: s.id,
              title: s.title,
              notes: s.notes,
              dueDate: s.dueDate,
              priority: s.priority,
              included: s.included,
            })),
          })),
        });
        toast.success(`Created ${result.created} task(s)`);
        // Full navigation avoids a stale client-side RSC cache after server actions.
        window.location.assign(tasksPath);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not create tasks');
      } finally {
        setCommitting(false);
      }
    });
  };

  return (
    <div
      className={
        embedded
          ? 'space-y-6'
          : 'mx-auto max-w-4xl space-y-8 px-4 pb-16 pt-6 text-white md:px-6'
      }
    >
      {!embedded ? (
        <div>
          <Link
            href={tasksPath}
            className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to tasks
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Extract tasks with AI</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Paste an email thread or meeting transcript. We use Anthropic to suggest tasks,
            subtasks, due dates, and project or client links. Review everything before they
            are added to this workspace.
          </p>
        </div>
      ) : null}

      {!rows ? (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-6">
          {!embedded ? (
            <div className="space-y-2">
              <Label htmlFor="raw">Email or transcript</Label>
              <Textarea
                id="raw"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste the full text here…"
                className="min-h-[220px] border-white/10 bg-white/5 text-sm text-white placeholder:text-zinc-600"
              />
              <p className="text-xs text-zinc-500">
                Requires <code className="text-zinc-400">ANTHROPIC_API_KEY</code> on the server.
                Optional: <code className="text-zinc-400">ANTHROPIC_TASK_EXTRACT_MODEL</code>.
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              We&apos;ll analyse the transcript above and suggest actionable tasks for this
              workspace.
            </p>
          )}
          <Button
            type="button"
            onClick={extract}
            disabled={extracting || rawText.trim().length < 20}
            className="bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
          >
            {extracting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extracting…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Extract tasks
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-xs text-zinc-500">
              If only the first group got a client or project from AI, we copy that link to
              the other groups—you can still change any row before adding.
            </p>
            <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setRows(null)}>
              Start over
            </Button>
            <Button
              type="button"
              onClick={commit}
              disabled={committing}
              className="bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
            >
              {committing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Add selected tasks'
              )}
            </Button>
            </div>
          </div>

          <div className="space-y-6">
            {rows.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-5"
              >
                <div className="flex flex-wrap items-start gap-3 border-b border-white/10 pb-4">
                  <Checkbox
                    checked={row.included}
                    onCheckedChange={(v) => {
                      const checked = v === true;
                      setRows((prev) =>
                        prev?.map((r) =>
                          r.id === row.id ? { ...r, included: checked } : r,
                        ) ?? null,
                      );
                    }}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <Label className="text-xs text-zinc-500">Parent task</Label>
                      <Input
                        value={row.title}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev?.map((r) =>
                              r.id === row.id ? { ...r, title: e.target.value } : r,
                            ) ?? null,
                          )
                        }
                        className="mt-1 border-white/10 bg-white/5 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500">Notes</Label>
                      <Textarea
                        value={row.notes ?? ''}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev?.map((r) =>
                              r.id === row.id ? { ...r, notes: e.target.value || null } : r,
                            ) ?? null,
                          )
                        }
                        className="mt-1 min-h-[72px] border-white/10 bg-white/5 text-sm text-white"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <Label className="text-xs text-zinc-500">Link to</Label>
                        <Select
                          value={assignValue(row.projectId, row.clientId)}
                          onValueChange={(v) => {
                            const { projectId, clientId } = parseAssignValue(v);
                            setRows((prev) =>
                              prev?.map((r) =>
                                r.id === row.id ? { ...r, projectId, clientId } : r,
                              ) ?? null,
                            );
                          }}
                        >
                          <SelectTrigger className="mt-1 border-white/10 bg-white/5 text-white">
                            <SelectValue placeholder="Project or client" />
                          </SelectTrigger>
                          <SelectContent className="border-white/10 bg-[#1A2535] text-white">
                            <SelectItem value="__none__">Choose…</SelectItem>
                            {projects.map((p) => (
                              <SelectItem key={p.id} value={`p:${p.id}`}>
                                {p.name}
                              </SelectItem>
                            ))}
                            {clients.map((c) => (
                              <SelectItem key={c.id} value={`c:${c.id}`}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500">Due date</Label>
                        <Input
                          type="date"
                          value={row.dueDate ?? ''}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev?.map((r) =>
                                r.id === row.id
                                  ? { ...r, dueDate: e.target.value || null }
                                  : r,
                              ) ?? null,
                            )
                          }
                          className="mt-1 border-white/10 bg-white/5 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500">Priority</Label>
                        <Select
                          value={row.priority}
                          onValueChange={(v) =>
                            setRows((prev) =>
                              prev?.map((r) =>
                                r.id === row.id
                                  ? {
                                      ...r,
                                      priority: v as ExtractedTaskReviewRow['priority'],
                                    }
                                  : r,
                              ) ?? null,
                            )
                          }
                        >
                          <SelectTrigger className="mt-1 border-white/10 bg-white/5 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-white/10 bg-[#1A2535] text-white">
                            {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                {row.subtasks.length > 0 ? (
                  <div className="mt-4 space-y-3 pl-8">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Subtasks
                    </p>
                    {row.subtasks.map((st) => (
                      <div
                        key={st.id}
                        className="flex gap-3 rounded-xl border border-white/6 bg-black/15 p-3"
                      >
                        <Checkbox
                          checked={st.included}
                          onCheckedChange={(v) => {
                            const checked = v === true;
                            setRows((prev) =>
                              prev?.map((r) =>
                                r.id === row.id
                                  ? {
                                      ...r,
                                      subtasks: r.subtasks.map((s) =>
                                        s.id === st.id ? { ...s, included: checked } : s,
                                      ),
                                    }
                                  : r,
                              ) ?? null,
                            );
                          }}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Input
                            value={st.title}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev?.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        subtasks: r.subtasks.map((s) =>
                                          s.id === st.id
                                            ? { ...s, title: e.target.value }
                                            : s,
                                        ),
                                      }
                                    : r,
                                ) ?? null,
                              )
                            }
                            className="border-white/10 bg-white/5 text-sm text-white"
                          />
                          <Textarea
                            value={st.notes ?? ''}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev?.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        subtasks: r.subtasks.map((s) =>
                                          s.id === st.id
                                            ? {
                                                ...s,
                                                notes: e.target.value || null,
                                              }
                                            : s,
                                        ),
                                      }
                                    : r,
                                ) ?? null,
                              )
                            }
                            placeholder="Subtask notes"
                            className="min-h-[56px] border-white/10 bg-white/5 text-xs text-white"
                          />
                          <div className="flex flex-wrap gap-2">
                            <Input
                              type="date"
                              value={st.dueDate ?? ''}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev?.map((r) =>
                                    r.id === row.id
                                      ? {
                                          ...r,
                                          subtasks: r.subtasks.map((s) =>
                                            s.id === st.id
                                              ? {
                                                  ...s,
                                                  dueDate: e.target.value || null,
                                                }
                                              : s,
                                          ),
                                        }
                                      : r,
                                  ) ?? null,
                                )
                              }
                              className="w-40 border-white/10 bg-white/5 text-xs text-white"
                            />
                            <Select
                              value={st.priority}
                              onValueChange={(v) =>
                                setRows((prev) =>
                                  prev?.map((r) =>
                                    r.id === row.id
                                      ? {
                                          ...r,
                                          subtasks: r.subtasks.map((s) =>
                                            s.id === st.id
                                              ? {
                                                  ...s,
                                                  priority:
                                                    v as (typeof st)['priority'],
                                                }
                                              : s,
                                          ),
                                        }
                                      : r,
                                  ) ?? null,
                                )
                              }
                            >
                              <SelectTrigger className="w-32 border-white/10 bg-white/5 text-xs text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="border-white/10 bg-[#1A2535] text-white">
                                {(['low', 'medium', 'high', 'urgent'] as const).map(
                                  (p) => (
                                    <SelectItem key={p} value={p}>
                                      {p}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {!embedded ? (
        <p className="text-xs text-zinc-500">
          Future: connect Gmail to scan new messages and surface suggested tasks for review
          in Ozer — see{' '}
          <code className="text-zinc-400">TASK_GMAIL_INGEST_ENABLED</code> placeholder in{' '}
          <code className="text-zinc-400">lib/integrations/gmail-tasks-ingest.placeholder.ts</code>.
        </p>
      ) : null}
    </div>
  );
}
