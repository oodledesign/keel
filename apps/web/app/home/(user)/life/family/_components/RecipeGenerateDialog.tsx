'use client';

import { useMemo, useState, useTransition } from 'react';

import { Loader2, Sparkles } from 'lucide-react';

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
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { bulkAddGeneratedRecipesAction } from '../_lib/actions';
import {
  type MealPreferencesRow,
  RECIPE_MEAL_TYPES,
  type RecipeMealType,
  type RecipeRow,
} from '../_lib/schema/family-meal.schema';
import { ACCENT, mealTypeLabels, titleCase, totalTimeLabel } from './meal-ui';

type GeneratedRecipePreview = {
  key: string;
  name: string;
  description: string;
  ingredients: string[];
  instructions: string;
  tags: string[];
  meal_type: RecipeMealType;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  inspiration: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: MealPreferencesRow;
  recipes: RecipeRow[];
  accountSlug?: string;
  onSaved: () => void;
};

type Step = 'configure' | 'preview';

export function RecipeGenerateDialog({
  open,
  onOpenChange,
  preferences,
  recipes,
  accountSlug,
  onSaved,
}: Props) {
  const scopeFields = accountSlug ? { accountSlug } : {};
  const favoriteCount = recipes.filter((r) => r.is_favorite).length;

  const [step, setStep] = useState<Step>('configure');
  const [batchSize, setBatchSize] = useState<5 | 10>(5);
  const [mealType, setMealType] = useState<RecipeMealType>('dinner');
  const [inspiration, setInspiration] = useState('');
  const [favoriteDishes, setFavoriteDishes] = useState('');
  const [useSavedFavorites, setUseSavedFavorites] = useState(true);
  const [generated, setGenerated] = useState<GeneratedRecipePreview[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const preferenceSummary = useMemo(() => {
    return [
      ...preferences.dietary_requirements,
      ...preferences.priorities.map(titleCase),
    ];
  }, [preferences.dietary_requirements, preferences.priorities]);

  function resetDialog() {
    setStep('configure');
    setGenerated([]);
    setSelectedKeys(new Set());
    setIsGenerating(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetDialog();
    onOpenChange(next);
  }

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/family/meal-plan/generate-recipes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          count: batchSize,
          mealType,
          inspiration,
          favoriteDishes,
          useSavedFavorites,
          ...scopeFields,
        }),
      });

      const body = (await response.json()) as {
        recipes?: Array<Omit<GeneratedRecipePreview, 'key'>>;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? 'Could not generate recipes');
      }

      const items = (body.recipes ?? []).map((recipe, index) => ({
        ...recipe,
        key: `${recipe.name}-${index}`,
        meal_type: (recipe.meal_type ?? mealType) as RecipeMealType,
      }));

      if (items.length === 0) {
        throw new Error('No recipes were returned');
      }

      setGenerated(items);
      setSelectedKeys(new Set(items.map((item) => item.key)));
      setStep('preview');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not generate recipes',
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function toggleRecipe(key: string, checked: boolean) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedKeys(
      checked ? new Set(generated.map((recipe) => recipe.key)) : new Set(),
    );
  }

  function handleAddSelected() {
    const selected = generated.filter((recipe) => selectedKeys.has(recipe.key));

    if (selected.length === 0) {
      toast.error('Select at least one recipe to add');
      return;
    }

    startTransition(async () => {
      const result = await bulkAddGeneratedRecipesAction({
        recipes: selected.map((recipe) => ({
          name: recipe.name,
          description: recipe.description || null,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions || null,
          tags: recipe.tags,
          meal_type: recipe.meal_type,
          prep_minutes: recipe.prep_minutes,
          cook_minutes: recipe.cook_minutes,
          servings: recipe.servings,
          inspiration: recipe.inspiration || null,
        })),
        ...scopeFields,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(
        `Added ${result.data.added} recipe${result.data.added === 1 ? '' : 's'} to your library`,
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
            <Sparkles className="h-5 w-5 text-[var(--ozer-accent-muted)]" />
            Generate recipes with AI
          </DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            {step === 'configure'
              ? 'Inspired by popular home cooking and trends — tailored to your preferences.'
              : 'Uncheck anything you do not want, then add the rest to your library.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'configure' ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>How many recipes?</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      value: 5 as const,
                      label: '1–5 recipes',
                      hint: 'A focused batch',
                    },
                    {
                      value: 10 as const,
                      label: '5–10 recipes',
                      hint: 'Fill out the library',
                    },
                  ] as const
                ).map((option) => {
                  const active = batchSize === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setBatchSize(option.value)}
                      className={cn(
                        'rounded-xl border px-3 py-3 text-left transition-colors',
                        active
                          ? 'border-[#FFE3DA]/40 bg-[var(--ozer-accent-subtle)]'
                          : 'border-[color:var(--workspace-shell-border)] hover:border-[color:var(--workspace-shell-border)]',
                      )}
                    >
                      <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                        {option.label}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                        {option.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gen-meal-type">Meal type</Label>
              <select
                id="gen-meal-type"
                value={mealType}
                onChange={(e) => setMealType(e.target.value as RecipeMealType)}
                className="h-9 w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 text-sm text-[var(--workspace-shell-text)] outline-none focus:border-[color:var(--workspace-shell-border)]"
              >
                {RECIPE_MEAL_TYPES.map((type) => (
                  <option
                    key={type}
                    value={type}
                    className="bg-[var(--ozer-surface-panel)]"
                  >
                    {mealTypeLabels[type]}
                  </option>
                ))}
              </select>
            </div>

            {preferenceSummary.length > 0 ? (
              <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
                <p className="text-xs font-medium text-[var(--workspace-shell-text-muted)]">
                  Using saved preferences
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {preferenceSummary.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[11px] text-[var(--workspace-shell-text-muted)] capitalize"
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

            <div className="space-y-1.5">
              <Label htmlFor="gen-favorites">Family favourites to echo</Label>
              <Textarea
                id="gen-favorites"
                rows={2}
                value={favoriteDishes}
                onChange={(e) => setFavoriteDishes(e.target.value)}
                placeholder="e.g. roast chicken, pad thai, fish pie, air-fryer salmon"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--workspace-shell-text-muted)]">
              <Checkbox
                checked={useSavedFavorites}
                onCheckedChange={(value) =>
                  setUseSavedFavorites(value === true)
                }
                className="mt-0.5"
              />
              <span>
                Include starred recipes from my library as inspiration
                {favoriteCount > 0 ? ` (${favoriteCount} saved)` : ''}
              </span>
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="gen-inspiration">Trends & inspiration</Label>
              <Input
                id="gen-inspiration"
                value={inspiration}
                onChange={(e) => setInspiration(e.target.value)}
                placeholder="e.g. viral one-pan dinners, IG pasta bakes, slow cooker"
              />
            </div>
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
              {generated.map((recipe) => {
                const checked = selectedKeys.has(recipe.key);
                const time = totalTimeLabel(
                  recipe.prep_minutes,
                  recipe.cook_minutes,
                );

                return (
                  <label
                    key={recipe.key}
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
                        toggleRecipe(recipe.key, value === true)
                      }
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                        {recipe.name}
                      </p>
                      {recipe.description ? (
                        <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                          {recipe.description}
                        </p>
                      ) : null}
                      {recipe.inspiration ? (
                        <p className="mt-1 text-[11px] text-[var(--ozer-accent-muted)]/80">
                          {recipe.inspiration}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--workspace-shell-text-muted)]">
                        {time ? <span>{time}</span> : null}
                        {recipe.servings ? (
                          <span>Serves {recipe.servings}</span>
                        ) : null}
                        <span>{recipe.ingredients.length} ingredients</span>
                      </div>
                      {recipe.tags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {recipe.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-1.5 py-0.5 text-[var(--workspace-shell-text-muted)] capitalize"
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
              onClick={() => setStep('configure')}
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

          {step === 'configure' ? (
            <Button
              onClick={() => void handleGenerate()}
              disabled={isGenerating}
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
              onClick={handleAddSelected}
              disabled={isPending || selectedCount === 0}
              style={{ backgroundColor: ACCENT }}
              className="text-[var(--workspace-shell-text)] hover:opacity-90"
            >
              {isPending
                ? 'Adding…'
                : `Add ${selectedCount} recipe${selectedCount === 1 ? '' : 's'}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
