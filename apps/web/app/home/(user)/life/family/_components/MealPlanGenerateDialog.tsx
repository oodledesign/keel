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
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[var(--workspace-shell-panel)] text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'fill' ? (
              <Wand2 className="h-5 w-5 text-[#5eead4]" />
            ) : (
              <Sparkles className="h-5 w-5 text-[#5eead4]" />
            )}
            {modeLabel} with AI
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
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
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <p className="text-xs font-medium text-zinc-400">
                  Using saved preferences
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {preferenceSummary.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] capitalize text-zinc-300"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
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
              <p className="text-sm text-zinc-400">
                {selectedCount} of {generated.length} selected
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-zinc-400"
                  onClick={() => toggleAll(true)}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-zinc-400"
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
                        ? 'border-[#5eead4]/30 bg-[#5eead4]/5'
                        : 'border-white/8 bg-white/[0.02] opacity-80',
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
                        <span className="text-[11px] font-semibold uppercase text-[#5eead4]/90">
                          {weekdayLabel(meal.date).slice(0, 3)}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {meal.date.slice(8, 10)}/{meal.date.slice(5, 7)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm font-semibold text-white">
                        {meal.title}
                      </p>
                      {meal.description ? (
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {meal.description}
                        </p>
                      ) : null}
                      {meal.tags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {meal.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-white/[0.06] px-1.5 py-0.5 capitalize text-zinc-400"
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
              className="text-white hover:opacity-90"
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
              className="text-white hover:opacity-90"
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
