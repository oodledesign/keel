'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Eye, Save } from 'lucide-react';

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
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { savePersonalVisionAction } from '~/lib/personal-vision/personal-vision.actions';
import {
  type PersonalVisionContent,
  VISION_GOAL_HORIZON_LABELS,
  VISION_GOAL_HORIZON_ORDER,
  type VisionGoalHorizon,
  ensureGoalHorizons,
} from '~/lib/personal-vision/personal-vision.schema';
import { VISION_STAGES } from '~/lib/personal-vision/vision-stages';

import { StringListEditor } from './string-list-editor';

type WorkspaceOption = {
  id: string;
  name: string;
  spaceType: string | null;
};

type Props = {
  initialContent: PersonalVisionContent;
  initialFinanceAccountIds: string[];
  initialDashboardEnabled: boolean;
  initialMorningPromptEnabled: boolean;
  workspaces: WorkspaceOption[];
};

function poundsInputFromPence(pence: number | null | undefined): string {
  if (pence == null || Number.isNaN(pence)) return '';
  return (pence / 100).toFixed(pence % 100 === 0 ? 0 : 2);
}

function penceFromPoundsInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function newLocalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function PersonalVisionSettingsForm({
  initialContent,
  initialFinanceAccountIds,
  initialDashboardEnabled,
  initialMorningPromptEnabled,
  workspaces,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dashboardEnabled, setDashboardEnabled] = useState(
    initialDashboardEnabled,
  );
  const [morningPromptEnabled, setMorningPromptEnabled] = useState(
    initialMorningPromptEnabled,
  );
  const [financeAccountIds, setFinanceAccountIds] = useState<string[]>(
    initialFinanceAccountIds,
  );
  const [content, setContent] = useState<PersonalVisionContent>(() => ({
    ...initialContent,
    goals: ensureGoalHorizons(initialContent.goals),
  }));
  const [openStage, setOpenStage] = useState<string | null>('foundations');

  const toggleFinanceAccount = (id: string, checked: boolean) => {
    setFinanceAccountIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id),
    );
  };

  const updateGoal = (
    horizon: VisionGoalHorizon,
    patch: Partial<PersonalVisionContent['goals'][number]>,
  ) => {
    setContent((prev) => ({
      ...prev,
      goals: ensureGoalHorizons(prev.goals).map((g) =>
        g.horizon === horizon ? { ...g, ...patch } : g,
      ),
    }));
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await savePersonalVisionAction({
        content: {
          ...content,
          goals: ensureGoalHorizons(content.goals),
        },
        financeAccountIds,
        dashboardEnabled,
        morningPromptEnabled,
      });

      if (!result?.success) {
        toast.error(result?.error ?? 'Could not save Personal Vision');
        return;
      }

      toast.success('Personal Vision saved');
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
            Personal Vision
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--workspace-shell-text-muted)]">
            Build a daily practice deck that reminds you why the work matters.
            Empty stages are skipped when you play the slideshow.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={pathsConfig.app.personalVision}>
              <Eye className="mr-1.5 h-4 w-4" />
              Preview slideshow
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            className="ozer-gradient-btn"
            disabled={pending}
            onClick={handleSave}
          >
            <Save className="mr-1.5 h-4 w-4" />
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <section className="space-y-4 rounded-xl border border-[color:var(--workspace-shell-border)] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="vision-dashboard-toggle" className="text-base">
              Show icon when Vision is empty
            </Label>
            <p className="mt-0.5 text-sm text-[var(--workspace-shell-text-muted)]">
              The top-bar icon appears automatically once your deck has content.
              Turn this on to keep the icon visible while you are still writing
              it (left of search on mobile).
            </p>
          </div>
          <Switch
            id="vision-dashboard-toggle"
            checked={dashboardEnabled}
            onCheckedChange={setDashboardEnabled}
          />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-[color:var(--workspace-shell-border)] pt-4">
          <div>
            <Label htmlFor="vision-morning-toggle" className="text-base">
              Morning reminder
            </Label>
            <p className="mt-0.5 text-sm text-[var(--workspace-shell-text-muted)]">
              Once a day, ask whether you want to open Personal Vision — only
              when your deck has content.
            </p>
          </div>
          <Switch
            id="vision-morning-toggle"
            checked={morningPromptEnabled}
            onCheckedChange={setMorningPromptEnabled}
          />
        </div>

        <div className="border-t border-[color:var(--workspace-shell-border)] pt-4">
          <Label className="text-base">Finance actuals workspaces</Label>
          <p className="mt-0.5 mb-3 text-sm text-[var(--workspace-shell-text-muted)]">
            Income from the Finances module in these workspaces is shown on
            wealth-goal slides (this month, a 6-month chart, and averages).
          </p>
          {workspaces.length === 0 ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Join or create a workspace with finances to connect live actuals.
            </p>
          ) : (
            <ul className="space-y-2">
              {workspaces.map((ws) => {
                const checked = financeAccountIds.includes(ws.id);
                return (
                  <li key={ws.id} className="flex items-center gap-3">
                    <Checkbox
                      id={`vision-finance-${ws.id}`}
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggleFinanceAccount(ws.id, value === true)
                      }
                    />
                    <Label
                      htmlFor={`vision-finance-${ws.id}`}
                      className="font-normal"
                    >
                      {ws.name}
                      {ws.spaceType ? (
                        <span className="ml-2 text-[var(--workspace-shell-text-muted)]">
                          ({ws.spaceType})
                        </span>
                      ) : null}
                    </Label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <div className="space-y-3">
        {VISION_STAGES.map((stage) => {
          const open = openStage === stage.id;
          return (
            <div
              key={stage.id}
              className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)]"
            >
              <button
                type="button"
                className={cn(
                  'flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition',
                  open
                    ? 'bg-[var(--workspace-shell-panel-hover)]'
                    : 'hover:bg-[var(--workspace-shell-panel-hover)]/60',
                )}
                onClick={() =>
                  setOpenStage((prev) => (prev === stage.id ? null : stage.id))
                }
                aria-expanded={open}
              >
                <div>
                  <p className="font-medium text-[var(--workspace-shell-text)]">
                    {stage.title}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--workspace-shell-text-muted)]">
                    {stage.description}
                  </p>
                </div>
                <span className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                  {open ? 'Hide' : 'Edit'}
                </span>
              </button>

              {open ? (
                <div className="space-y-4 border-t border-[color:var(--workspace-shell-border)] px-4 py-4">
                  {stage.id === 'foundations' ? (
                    <StringListEditor
                      values={content.foundations}
                      onChange={(foundations) =>
                        setContent((c) => ({ ...c, foundations }))
                      }
                      multiline
                      placeholder="A foundation belief…"
                      addLabel="Add foundation"
                    />
                  ) : null}

                  {stage.id === 'principles' ? (
                    <StringListEditor
                      values={content.principles}
                      onChange={(principles) =>
                        setContent((c) => ({ ...c, principles }))
                      }
                      placeholder="A guiding principle…"
                      addLabel="Add principle"
                    />
                  ) : null}

                  {stage.id === 'daily_ritual' ? (
                    <StringListEditor
                      values={content.daily_ritual}
                      onChange={(daily_ritual) =>
                        setContent((c) => ({ ...c, daily_ritual }))
                      }
                      multiline
                      placeholder="A ritual step…"
                      addLabel="Add step"
                    />
                  ) : null}

                  {stage.id === 'long_term_mindset' ? (
                    <StringListEditor
                      values={content.long_term_mindset}
                      onChange={(long_term_mindset) =>
                        setContent((c) => ({ ...c, long_term_mindset }))
                      }
                      multiline
                      placeholder="A long-term mindset reminder…"
                      addLabel="Add reminder"
                    />
                  ) : null}

                  {stage.id === 'identity_snapshot' ? (
                    <Textarea
                      value={content.identity_snapshot}
                      onChange={(e) =>
                        setContent((c) => ({
                          ...c,
                          identity_snapshot: e.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="Who you are becoming…"
                    />
                  ) : null}

                  {stage.id === 'legacy_to_date' ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Headline</Label>
                        <Input
                          value={content.legacy_to_date.headline}
                          onChange={(e) =>
                            setContent((c) => ({
                              ...c,
                              legacy_to_date: {
                                ...c.legacy_to_date,
                                headline: e.target.value,
                              },
                            }))
                          }
                          placeholder="Short legacy headline"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Body</Label>
                        <Textarea
                          value={content.legacy_to_date.body}
                          onChange={(e) =>
                            setContent((c) => ({
                              ...c,
                              legacy_to_date: {
                                ...c.legacy_to_date,
                                body: e.target.value,
                              },
                            }))
                          }
                          rows={4}
                          placeholder="What you have already built…"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Wins</Label>
                        <StringListEditor
                          values={content.legacy_to_date.wins}
                          onChange={(wins) =>
                            setContent((c) => ({
                              ...c,
                              legacy_to_date: { ...c.legacy_to_date, wins },
                            }))
                          }
                          placeholder="A win…"
                          addLabel="Add win"
                        />
                      </div>
                    </div>
                  ) : null}

                  {stage.id === 'story' ? (
                    <div className="space-y-3">
                      {content.story.items.map((item, index) => (
                        <div
                          key={item.id ?? `story-${index}`}
                          className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] p-3"
                        >
                          <Input
                            value={item.label}
                            onChange={(e) => {
                              const items = [...content.story.items];
                              items[index] = {
                                ...item,
                                label: e.target.value,
                              };
                              setContent((c) => ({
                                ...c,
                                story: { items },
                              }));
                            }}
                            placeholder="Milestone label"
                          />
                          <Input
                            value={item.detail ?? ''}
                            onChange={(e) => {
                              const items = [...content.story.items];
                              items[index] = {
                                ...item,
                                detail: e.target.value,
                              };
                              setContent((c) => ({
                                ...c,
                                story: { items },
                              }));
                            }}
                            placeholder="Optional detail"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setContent((c) => ({
                                ...c,
                                story: {
                                  items: c.story.items.filter(
                                    (_, i) => i !== index,
                                  ),
                                },
                              }))
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setContent((c) => ({
                            ...c,
                            story: {
                              items: [
                                ...c.story.items,
                                { id: newLocalId(), label: '', detail: '' },
                              ],
                            },
                          }))
                        }
                      >
                        Add milestone
                      </Button>
                    </div>
                  ) : null}

                  {stage.id === 'manifesto' ? (
                    <Textarea
                      value={content.manifesto}
                      onChange={(e) =>
                        setContent((c) => ({
                          ...c,
                          manifesto: e.target.value,
                        }))
                      }
                      rows={12}
                      placeholder="Write the future in present tense…"
                    />
                  ) : null}

                  {stage.id === 'character' ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Character traits</Label>
                        <StringListEditor
                          values={content.character.traits}
                          onChange={(traits) =>
                            setContent((c) => ({
                              ...c,
                              character: { ...c.character, traits },
                            }))
                          }
                          placeholder="Trait…"
                          addLabel="Add trait"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Body & style</Label>
                        <StringListEditor
                          values={content.character.style}
                          onChange={(style) =>
                            setContent((c) => ({
                              ...c,
                              character: { ...c.character, style },
                            }))
                          }
                          placeholder="Style note…"
                          addLabel="Add style note"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Achievements to pursue</Label>
                        <StringListEditor
                          values={content.character.achievements}
                          onChange={(achievements) =>
                            setContent((c) => ({
                              ...c,
                              character: { ...c.character, achievements },
                            }))
                          }
                          placeholder="Achievement…"
                          addLabel="Add achievement"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mentors</Label>
                        <StringListEditor
                          values={content.character.mentors}
                          onChange={(mentors) =>
                            setContent((c) => ({
                              ...c,
                              character: { ...c.character, mentors },
                            }))
                          }
                          placeholder="Mentor…"
                          addLabel="Add mentor"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Personal brand</Label>
                        <Textarea
                          value={content.character.branding}
                          onChange={(e) =>
                            setContent((c) => ({
                              ...c,
                              character: {
                                ...c.character,
                                branding: e.target.value,
                              },
                            }))
                          }
                          rows={4}
                          placeholder="How you want to be known…"
                        />
                      </div>
                    </div>
                  ) : null}

                  {stage.id === 'goals' ? (
                    <div className="space-y-6">
                      {VISION_GOAL_HORIZON_ORDER.map((horizon) => {
                        const block = content.goals.find(
                          (g) => g.horizon === horizon,
                        ) ?? {
                          horizon,
                          title: '',
                          wealth_goals: [],
                          other_goals: [],
                          standards: [],
                        };
                        return (
                          <div
                            key={horizon}
                            className="space-y-3 rounded-lg border border-[color:var(--workspace-shell-border)] p-3"
                          >
                            <p className="font-medium text-[var(--workspace-shell-text)]">
                              {VISION_GOAL_HORIZON_LABELS[horizon]}
                            </p>
                            <Input
                              value={block.title ?? ''}
                              onChange={(e) =>
                                updateGoal(horizon, { title: e.target.value })
                              }
                              placeholder="Optional section title"
                            />
                            <div className="space-y-2">
                              <Label>Wealth goals</Label>
                              {block.wealth_goals.map((goal, index) => (
                                <div
                                  key={goal.id ?? `wealth-${horizon}-${index}`}
                                  className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] p-3"
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row">
                                    <Input
                                      value={goal.label}
                                      onChange={(e) => {
                                        const wealth_goals = [
                                          ...block.wealth_goals,
                                        ];
                                        wealth_goals[index] = {
                                          ...goal,
                                          label: e.target.value,
                                        };
                                        updateGoal(horizon, { wealth_goals });
                                      }}
                                      placeholder="Wealth goal label"
                                      className="flex-1"
                                    />
                                    <Input
                                      value={poundsInputFromPence(
                                        goal.target_pence,
                                      )}
                                      onChange={(e) => {
                                        const wealth_goals = [
                                          ...block.wealth_goals,
                                        ];
                                        wealth_goals[index] = {
                                          ...goal,
                                          target_pence: penceFromPoundsInput(
                                            e.target.value,
                                          ),
                                        };
                                        updateGoal(horizon, { wealth_goals });
                                      }}
                                      placeholder="Overall £"
                                      inputMode="decimal"
                                      className="sm:w-28"
                                    />
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="space-y-1">
                                      <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                                        Due date
                                      </Label>
                                      <Input
                                        type="date"
                                        value={goal.due_date ?? ''}
                                        onChange={(e) => {
                                          const wealth_goals = [
                                            ...block.wealth_goals,
                                          ];
                                          wealth_goals[index] = {
                                            ...goal,
                                            due_date: e.target.value || null,
                                          };
                                          updateGoal(horizon, { wealth_goals });
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                                        Cadence
                                      </Label>
                                      <Select
                                        value={goal.cadence ?? 'one_off'}
                                        onValueChange={(value) => {
                                          const wealth_goals = [
                                            ...block.wealth_goals,
                                          ];
                                          wealth_goals[index] = {
                                            ...goal,
                                            cadence:
                                              value === 'monthly'
                                                ? 'monthly'
                                                : 'one_off',
                                          };
                                          updateGoal(horizon, { wealth_goals });
                                        }}
                                      >
                                        <SelectTrigger className="h-9">
                                          <SelectValue placeholder="Cadence" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="one_off">
                                            One-off
                                          </SelectItem>
                                          <SelectItem value="monthly">
                                            Monthly
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                                        £ / month
                                      </Label>
                                      <Input
                                        value={poundsInputFromPence(
                                          goal.monthly_target_pence,
                                        )}
                                        onChange={(e) => {
                                          const wealth_goals = [
                                            ...block.wealth_goals,
                                          ];
                                          wealth_goals[index] = {
                                            ...goal,
                                            monthly_target_pence:
                                              penceFromPoundsInput(
                                                e.target.value,
                                              ),
                                            cadence: 'monthly',
                                          };
                                          updateGoal(horizon, { wealth_goals });
                                        }}
                                        placeholder="e.g. 2000"
                                        inputMode="decimal"
                                        disabled={goal.cadence !== 'monthly'}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                                        Months
                                      </Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        max={60}
                                        value={goal.months ?? ''}
                                        onChange={(e) => {
                                          const raw = e.target.value.trim();
                                          const n = raw
                                            ? Number.parseInt(raw, 10)
                                            : null;
                                          const wealth_goals = [
                                            ...block.wealth_goals,
                                          ];
                                          wealth_goals[index] = {
                                            ...goal,
                                            months:
                                              n != null &&
                                              Number.isFinite(n) &&
                                              n > 0
                                                ? n
                                                : null,
                                            cadence: 'monthly',
                                          };
                                          updateGoal(horizon, { wealth_goals });
                                        }}
                                        placeholder="e.g. 6"
                                        disabled={goal.cadence !== 'monthly'}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-end">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        updateGoal(horizon, {
                                          wealth_goals:
                                            block.wealth_goals.filter(
                                              (_, i) => i !== index,
                                            ),
                                        })
                                      }
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateGoal(horizon, {
                                    wealth_goals: [
                                      ...block.wealth_goals,
                                      {
                                        id: newLocalId(),
                                        label: '',
                                        target_pence: null,
                                        due_date: null,
                                        cadence: 'one_off',
                                        monthly_target_pence: null,
                                        months: null,
                                      },
                                    ],
                                  })
                                }
                              >
                                Add wealth goal
                              </Button>
                            </div>
                            <div className="space-y-2">
                              <Label>Other goals</Label>
                              <StringListEditor
                                values={block.other_goals}
                                onChange={(other_goals) =>
                                  updateGoal(horizon, { other_goals })
                                }
                                placeholder="Goal…"
                                addLabel="Add goal"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Standards (optional)</Label>
                              <StringListEditor
                                values={block.standards}
                                onChange={(standards) =>
                                  updateGoal(horizon, { standards })
                                }
                                placeholder="Standard…"
                                addLabel="Add standard"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {stage.id === 'affirmations' ? (
                    <StringListEditor
                      values={content.affirmations}
                      onChange={(affirmations) =>
                        setContent((c) => ({ ...c, affirmations }))
                      }
                      multiline
                      placeholder="An affirmation…"
                      addLabel="Add affirmation"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link href={pathsConfig.app.personalVision}>Preview slideshow</Link>
        </Button>
        <Button
          type="button"
          className="ozer-gradient-btn"
          disabled={pending}
          onClick={handleSave}
        >
          {pending ? 'Saving…' : 'Save Personal Vision'}
        </Button>
      </div>
    </div>
  );
}
