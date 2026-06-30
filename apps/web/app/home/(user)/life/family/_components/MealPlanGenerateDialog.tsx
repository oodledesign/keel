'use client';

import { useMemo, useState, useTransition } from 'react';

import { Loader2, Sparkles, Wand2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { applyGeneratedWeekAction } from '../_lib/actions';
import { weekdayLabel } from '../_lib/server/family-meal.dates';
import type { MealPreferencesRow } from '../_lib/schema/family-meal.schema';
import { ACCENT, titleCase } from './meal-ui';

type GeneratedMealPreview = {
  key: string;
  date: string;
  title: string;
  description: string;
  tags: string[];
  recipeId: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'fill' | 'generate';
  targetDates: string[];
  planDates: string[];
  preferences: MealPreferencesRow;
  accountSlug?: string;
  onSaved: () => void;
};

type Step = 'confirm' | 'preview';

export function MealPlanGenerateDialog({
  open,
  onOpenChange,
  mode,
  targetDates,
  planDates,
  preferences,
  accountSlug,
  onSaved,
}: Props) {
  const scopeFields = accountSlug ? { accountSlug } : {};
  const [step, setStep] = useState<Step>('confirm');
  const [generated, setGenerated] = useState<GeneratedMealPreview[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const preferenceSummary = useMemo(
    () => [
      ...preferences.dietary_requirements,
      ...preferences.priorities.map(titleCase),
    ],
    [preferences.dietary_requirements, preferences.priorities],
  );

  const modeLabel = mode === 'fill' ? 'Fill gaps' : 'Generate plan';
  const dayCount = targetDates.length;

  function resetDialog() {
    setStep('confirm');
    setGenerated([]);
    setSelectedKeys(new Set());
    setIsGenerating(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetDialog();
    onOpenChange(next);
  }

  async function handleGenerate() {
    if (targetDates.length === 0) {
      toast.info('No days to plan — every slot is already filled.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/family/meal-plan/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode,
          dates: targetDates,
          contextDates: planDates,
          ...scopeFields,
        }),
      });

      const body = (await response.json()) as {
        meals?: Array<Omit<GeneratedMealPreview, 'key'>>;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? 'Could not generate meal plan');
      }

      const items = (body.meals ?? []).map((meal) => ({
        ...meal,
        key: meal.date,
      }));

      if (items.length === 0) {
        throw new Error('The planner did not return any meals');
      }

      setGenerated(items);
      setSelectedKeys(new Set(items.map((item) => item.key)));
      setStep('preview');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not generate meal plan',
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function toggleMeal(key: string, checked: boolean) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedKeys(
      checked ? new Set(generated.map((meal) => meal.key)) : new Set(),
    );
  }

  function handleApplySelected() {
    const selected = generated.filter((meal) => selectedKeys.has(meal.key));

    if (selected.length === 0) {
      toast.error('Select at least one day to add');
      return;
    }

    startTransition(async () => {
      const result = await applyGeneratedWeekAction({
        entries: selected.map((meal) => ({
          planDate: meal.date,
          mealType: 'dinner' as const,
          title: meal.title,
          notes: meal.description || null,
          recipeId: meal.recipeId ?? null,
        })),
        ...scopeFields,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(
        mode === 'fill'
          ? `Filled ${selected.length} day${selected.length === 1 ? '' : 's'}`
          : `Updated ${selected.length} day${selected.length === 1 ? '' : 's'}`,
      );
      handleOpenChange(false);
      onSaved();
    });
  }

  const selectedCount = selectedKeys.size;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'fill' ? (
              <Wand2 className="h-5 w-5 text-[var(--ozer-accent-muted)]" />
            ) : (
              <Sparkles className="h-5 w-5 text-[var(--ozer-accent-muted)]" />
            )}
            {modeLabel} with AI
          </DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            {step === 'confirm'
              ? mode === 'fill'
                ? `Suggest dinners for ${dayCount} empty day${dayCount === 1 ? '' : 's'}, keeping your existing meals in mind.`
                : `Suggest dinners for all ${dayCount} day${dayCount === 1 ? '' : 's'} in this view.`
              : 'Uncheck any days you do not want, then apply the rest to your plan.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'confirm' ? (
          <div className="space-y-4">
            {preferenceSummary.length > 0 ? (
              <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
                <p className="text-xs font-medium text-[var(--workspace-shell-text-muted)]">
                  Using saved preferences
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {preferenceSummary.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[11px] capitalize text-[var(--workspace-shell-text-muted)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Tip: set dietary requirements in Preferences for better results.
              </p>
            )}

            {mode === 'generate' ? (
              <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-100/80">
                Days that already have meals will be replaced if you include them
                in the preview.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                {selectedCount} of {generated.length} selected
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[var(--workspace-shell-text-muted)]"
                  onClick={() => toggleAll(true)}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[var(--workspace-shell-text-muted)]"
                  onClick={() => toggleAll(false)}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {generated.map((meal) => {
                const checked = selectedKeys.has(meal.key);

                return (
                  <label
                    key={meal.key}
                    className={cn(
                      'flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors',
                      checked
                        ? 'border-[#FFE3DA]/30 bg-[#FFE3DA]/5'
                        : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] opacity-80',
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggleMeal(meal.key, value === true)
                      }
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] font-semibold uppercase text-[var(--ozer-accent-muted)]/90">
                          {weekdayLabel(meal.date).slice(0, 3)}
                        </span>
                        <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
                          {meal.date.slice(8, 10)}/{meal.date.slice(5, 7)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm font-semibold text-[var(--workspace-shell-text)]">
                        {meal.title}
                      </p>
                      {meal.description ? (
                        <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                          {meal.description}
                        </p>
                      ) : null}
                      {meal.tags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {meal.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-1.5 py-0.5 capitalize text-[var(--workspace-shell-text-muted)]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'preview' ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep('confirm')}
              disabled={isPending}
            >
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
          )}

          {step === 'confirm' ? (
            <Button
              onClick={() => void handleGenerate()}
              disabled={isGenerating || dayCount === 0}
              style={{ backgroundColor: ACCENT }}
              className="text-[var(--workspace-shell-text)] hover:opacity-90"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Generate preview
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleApplySelected}
              disabled={isPending || selectedCount === 0}
              style={{ backgroundColor: ACCENT }}
              className="text-[var(--workspace-shell-text)] hover:opacity-90"
            >
              {isPending
                ? 'Applying…'
                : `Apply ${selectedCount} day${selectedCount === 1 ? '' : 's'}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
