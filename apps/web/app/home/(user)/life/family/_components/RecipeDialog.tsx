'use client';

import { type RefObject, useRef, useState, useTransition } from 'react';

import { ExternalLink, ImageIcon, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
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

import type { RecipeImageCandidate } from '~/lib/ai/recipe-extract-utils';
import { resolveExtractOrigin } from '~/lib/ai/recipe-source-label';

import { upsertRecipeAction } from '../_lib/actions';
import {
  RECIPE_MEAL_TYPES,
  type RecipeInput,
  type RecipeMealType,
  type RecipeRow,
  type RecipeSource,
} from '../_lib/schema/family-meal.schema';
import { RecipeBadges } from './RecipeBadges';
import {
  ACCENT,
  dietaryChoices,
  mealTypeLabels,
  priorityChoices,
} from './meal-ui';

const MAX_COVER_BYTES = 4_000_000;

/** Prefill for a new recipe (e.g. after AI extract) — never has an id. */
export type RecipeFormDraft = {
  name: string;
  description: string | null;
  ingredients: string[];
  instructions: string | null;
  tags: string[];
  meal_type: RecipeMealType;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  is_favorite?: boolean;
  source?: RecipeSource;
  source_label?: string | null;
  source_url?: string | null;
  image_url?: string | null;
  image_candidates?: RecipeImageCandidate[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: RecipeRow | null;
  /** When creating, optional extract/import draft to review before save. */
  draft?: RecipeFormDraft | null;
  /** Bumps when a new import arrives so the form remounts even if names match. */
  draftKey?: number;
  accountSlug?: string;
  onSaved: () => void;
};

const suggestedTags = [...priorityChoices, ...dietaryChoices];

function toForm(recipe: RecipeRow | null, draft?: RecipeFormDraft | null) {
  const source = recipe ?? draft ?? null;
  const candidates = draft?.image_candidates ?? [];
  return {
    name: source?.name ?? '',
    description: source?.description ?? '',
    ingredients: (source?.ingredients ?? []).join('\n'),
    instructions: source?.instructions ?? '',
    tags: source?.tags ?? [],
    meal_type: (source?.meal_type ?? 'dinner') as RecipeMealType,
    prep_minutes: source?.prep_minutes?.toString() ?? '',
    cook_minutes: source?.cook_minutes?.toString() ?? '',
    servings: source?.servings?.toString() ?? '',
    is_favorite: source?.is_favorite ?? false,
    source: source?.source ?? null,
    source_label: source?.source_label ?? null,
    source_url: source?.source_url ?? '',
    image_url: source?.image_url ?? candidates[0]?.url ?? null,
    image_data: null as string | null,
    image_candidates: candidates,
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read image'));
    };
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

function isStoredCoverUrl(url: string | null | undefined) {
  return Boolean(url?.includes('/account_image/'));
}

function resolveImportSource(
  source: RecipeSource | null | undefined,
  sourceUrl: string | null,
): RecipeSource {
  if (source === 'instagram' || source === 'website' || source === 'ai') {
    return source;
  }
  return resolveExtractOrigin(sourceUrl, null)?.source ?? 'ai';
}

export function RecipeDialog({
  open,
  onOpenChange,
  recipe,
  draft = null,
  draftKey = 0,
  accountSlug,
  onSaved,
}: Props) {
  const formKey = recipe?.id ?? (draft ? `draft:${draftKey}` : 'new');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        {open ? (
          <RecipeForm
            key={formKey}
            recipe={recipe}
            draft={draft}
            accountSlug={accountSlug}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RecipeForm({
  recipe,
  draft,
  accountSlug,
  onClose,
  onSaved,
}: {
  recipe: RecipeRow | null;
  draft?: RecipeFormDraft | null;
  accountSlug?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const scopeFields = accountSlug ? { accountSlug } : {};
  const [form, setForm] = useState(() => toForm(recipe, draft));
  const [customTag, setCustomTag] = useState('');
  const [isPending, startTransition] = useTransition();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const isImportReview = !recipe && Boolean(draft);

  function toggleTag(tag: string) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag)
        ? f.tags.filter((t) => t !== tag)
        : [...f.tags, tag],
    }));
  }

  function addCustomTag() {
    const tag = customTag.trim().toLowerCase();
    if (!tag) return;
    if (!form.tags.includes(tag)) {
      setForm((f) => ({ ...f, tags: [...f.tags, tag] }));
    }
    setCustomTag('');
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error('Give the recipe a name');
      return;
    }

    const toNum = (v: string) => {
      const n = Number.parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    };

    const sourceUrl = form.source_url.trim() || null;
    if (sourceUrl) {
      try {
        const parsed = new URL(sourceUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          toast.error('Source link must start with http or https');
          return;
        }
      } catch {
        toast.error('Source link does not look like a valid URL');
        return;
      }
    }

    const coverPayload = form.image_data
      ? { image_data: form.image_data, image_url: null, remote_image_url: null }
      : form.image_url && isStoredCoverUrl(form.image_url)
        ? {
            image_url: form.image_url,
            image_data: null,
            remote_image_url: null,
          }
        : form.image_url
          ? {
              remote_image_url: form.image_url,
              image_url: null,
              image_data: null,
            }
          : { image_url: null, image_data: null, remote_image_url: null };

    const payload: RecipeInput = {
      id: recipe?.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      ingredients: form.ingredients
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      instructions: form.instructions.trim() || null,
      tags: form.tags,
      meal_type: form.meal_type,
      prep_minutes: toNum(form.prep_minutes),
      cook_minutes: toNum(form.cook_minutes),
      servings: toNum(form.servings),
      is_favorite: form.is_favorite,
      source_url: sourceUrl,
      ...coverPayload,
      ...(isImportReview
        ? {
            source: resolveImportSource(form.source, sourceUrl),
            source_label:
              form.source_label ??
              resolveExtractOrigin(sourceUrl, form.source_label)
                ?.source_label ??
              null,
          }
        : {}),
    };

    startTransition(async () => {
      const result = await upsertRecipeAction({ ...payload, ...scopeFields });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.data.coverWarning) {
        toast.warning(result.data.coverWarning);
      }
      toast.success(recipe ? 'Recipe updated' : 'Recipe added');
      onClose();
      onSaved();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {recipe
            ? 'Edit recipe'
            : isImportReview
              ? 'Review imported recipe'
              : 'Add recipe'}
        </DialogTitle>
        <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
          {isImportReview
            ? 'Check the details below, then save to your library. Nothing is saved until you confirm.'
            : 'Build your library so the planner can reuse meals you love.'}
        </DialogDescription>
      </DialogHeader>

      {isImportReview ||
      recipe?.source === 'instagram' ||
      recipe?.source === 'website' ||
      recipe?.source === 'ai' ? (
        <RecipeBadges
          source={form.source ?? recipe?.source}
          sourceLabel={form.source_label}
          sourceUrl={form.source_url.trim() || null}
        />
      ) : null}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="recipe-name">Name</Label>
          <Input
            id="recipe-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Chicken stir fry"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="recipe-desc">Description</Label>
          <Textarea
            id="recipe-desc"
            rows={2}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="One-line summary"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="recipe-source-url">Source link</Label>
          <Input
            id="recipe-source-url"
            data-test="recipe-source-url"
            type="url"
            inputMode="url"
            value={form.source_url}
            onChange={(e) =>
              setForm((f) => ({ ...f, source_url: e.target.value }))
            }
            placeholder="https://… (optional)"
          />
          {/^https?:\/\//i.test(form.source_url.trim()) ? (
            <a
              href={form.source_url.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[var(--workspace-shell-text-muted)] underline-offset-2 hover:text-[var(--workspace-shell-text)] hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View original
            </a>
          ) : (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Optional. Instagram or the page this recipe came from.
            </p>
          )}
        </div>

        <RecipeCoverFields
          form={form}
          fileInputRef={coverInputRef}
          onChange={(next) => setForm((f) => ({ ...f, ...next }))}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="recipe-prep">Prep (min)</Label>
            <Input
              id="recipe-prep"
              inputMode="numeric"
              value={form.prep_minutes}
              onChange={(e) =>
                setForm((f) => ({ ...f, prep_minutes: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipe-cook">Cook (min)</Label>
            <Input
              id="recipe-cook"
              inputMode="numeric"
              value={form.cook_minutes}
              onChange={(e) =>
                setForm((f) => ({ ...f, cook_minutes: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipe-servings">Serves</Label>
            <Input
              id="recipe-servings"
              inputMode="numeric"
              value={form.servings}
              onChange={(e) =>
                setForm((f) => ({ ...f, servings: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipe-meal">Meal</Label>
            <select
              id="recipe-meal"
              value={form.meal_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  meal_type: e.target.value as RecipeMealType,
                }))
              }
              className="h-9 w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 text-sm text-[var(--workspace-shell-text)] outline-none focus:border-[color:var(--workspace-shell-border)]"
            >
              {RECIPE_MEAL_TYPES.map((mt) => (
                <option
                  key={mt}
                  value={mt}
                  className="bg-[var(--ozer-surface-panel)]"
                >
                  {mealTypeLabels[mt]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="recipe-ingredients">Ingredients</Label>
          <Textarea
            id="recipe-ingredients"
            rows={4}
            value={form.ingredients}
            onChange={(e) =>
              setForm((f) => ({ ...f, ingredients: e.target.value }))
            }
            placeholder="One ingredient per line"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="recipe-instructions">Instructions</Label>
          <Textarea
            id="recipe-instructions"
            rows={4}
            value={form.instructions}
            onChange={(e) =>
              setForm((f) => ({ ...f, instructions: e.target.value }))
            }
            placeholder="Optional method / steps"
          />
        </div>

        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set([...suggestedTags, ...form.tags])).map(
              (tag) => {
                const active = form.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                      active
                        ? 'border-transparent text-[var(--workspace-shell-text)]'
                        : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                    )}
                    style={active ? { backgroundColor: ACCENT } : undefined}
                  >
                    {tag}
                  </button>
                );
              },
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomTag();
                }
              }}
              placeholder="Add custom tag"
              className="h-8 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCustomTag}
            >
              Add
            </Button>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--workspace-shell-text-muted)]">
          <input
            type="checkbox"
            checked={form.is_favorite}
            onChange={(e) =>
              setForm((f) => ({ ...f, is_favorite: e.target.checked }))
            }
            className="h-4 w-4 accent-[#059669]"
          />
          Mark as favourite
        </label>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isPending}
          style={{ backgroundColor: ACCENT }}
          className="text-[var(--workspace-shell-text)] hover:opacity-90"
        >
          {isPending ? 'Saving…' : recipe ? 'Save changes' : 'Add recipe'}
        </Button>
      </DialogFooter>
    </>
  );
}

type CoverForm = {
  image_url: string | null;
  image_data: string | null;
  image_candidates: RecipeImageCandidate[];
};

function RecipeCoverFields({
  form,
  fileInputRef,
  onChange,
}: {
  form: CoverForm;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onChange: (next: Partial<CoverForm>) => void;
}) {
  const preview = form.image_data ?? form.image_url;
  const hasCandidates = form.image_candidates.length > 0;

  async function handleUpload(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a photo');
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      toast.error('Image is too large — please use a smaller photo');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      onChange({ image_data: dataUrl, image_url: null });
    } catch {
      toast.error('Could not read that image');
    }
  }

  return (
    <div className="space-y-2">
      <Label>Cover photo</Label>
      {preview ? (
        <div className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="h-40 w-full object-cover" />
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] text-xs text-[var(--workspace-shell-text-muted)]">
          No cover photo
        </div>
      )}

      {hasCandidates ? (
        <div className="grid grid-cols-4 gap-2">
          {form.image_candidates.map((candidate) => {
            const selected =
              !form.image_data && form.image_url === candidate.url;
            return (
              <button
                key={candidate.url}
                type="button"
                onClick={() =>
                  onChange({ image_url: candidate.url, image_data: null })
                }
                className={cn(
                  'overflow-hidden rounded-lg border-2 transition-colors',
                  selected
                    ? 'border-transparent'
                    : 'border-[color:var(--workspace-shell-border)] hover:border-[color:var(--workspace-shell-text-muted)]',
                )}
                style={selected ? { borderColor: ACCENT } : undefined}
                aria-label="Choose cover photo"
                aria-pressed={selected}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={candidate.url}
                  alt=""
                  className="h-14 w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            void handleUpload(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-test="recipe-cover-upload"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
          {preview ? 'Replace photo' : 'Upload photo'}
        </Button>
        {preview ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-test="recipe-cover-skip"
            onClick={() => onChange({ image_url: null, image_data: null })}
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Skip photo
          </Button>
        ) : null}
      </div>
      {hasCandidates ? (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          Pick a photo from the page, upload your own, or skip.
        </p>
      ) : null}
    </div>
  );
}
