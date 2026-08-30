'use client';

import { useRef, useState } from 'react';

import { ClipboardPaste, ImageIcon, Link2, Loader2 } from 'lucide-react';

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

import { useAiCreditsExhausted } from '~/components/ai/ai-credits-exhausted-context';
import { handleAiCreditsFailure } from '~/components/ai/handle-ai-credits-failure';
import type { RecipeMealType } from '~/home/(user)/life/family/_lib/schema/family-meal.schema';
import type { RecipeImageCandidate } from '~/lib/ai/recipe-extract-utils';

import type { RecipeFormDraft } from './RecipeDialog';
import { ACCENT } from './meal-ui';

type ImportSource = 'text' | 'url' | 'image';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountSlug?: string;
  onExtracted: (draft: RecipeFormDraft) => void;
};

const SOURCE_TABS: Array<{
  id: ImportSource;
  label: string;
  icon: typeof ClipboardPaste;
}> = [
  { id: 'text', label: 'Paste text', icon: ClipboardPaste },
  { id: 'url', label: 'Link', icon: Link2 },
  { id: 'image', label: 'Photo', icon: ImageIcon },
];

const MAX_IMAGE_BYTES = 4_000_000;

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

export function RecipeImportDialog({
  open,
  onOpenChange,
  accountSlug,
  onExtracted,
}: Props) {
  const { reportExhausted, accountId, billingHref } = useAiCreditsExhausted();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<ImportSource>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  function reset() {
    setSource('text');
    setText('');
    setUrl('');
    setImageName(null);
    setImageDataUrl(null);
    setIsExtracting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleImageChange(file: File | null) {
    if (!file) {
      setImageName(null);
      setImageDataUrl(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a photo or screenshot');
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Image is too large — please use a smaller photo');
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setImageName(file.name);
      setImageDataUrl(dataUrl);
    } catch {
      toast.error('Could not read that image');
    }
  }

  async function handleExtract() {
    let payload = '';

    if (source === 'text') {
      payload = text.trim();
      if (payload.length < 20) {
        toast.error('Paste a bit more recipe text so we can extract it');
        return;
      }
    } else if (source === 'url') {
      payload = url.trim();
      if (!payload) {
        toast.error('Add a recipe link');
        return;
      }
      try {
        const parsed = new URL(payload);
        if (!parsed.protocol.startsWith('http')) {
          toast.error('That does not look like a valid link');
          return;
        }
      } catch {
        toast.error('That does not look like a valid link');
        return;
      }
    } else {
      if (!imageDataUrl) {
        toast.error('Choose a photo or screenshot first');
        return;
      }
      payload = imageDataUrl;
    }

    setIsExtracting(true);
    try {
      const response = await fetch('/api/recipes/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source,
          payload,
          ...(accountSlug ? { accountSlug } : {}),
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        recipe?: {
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
          source_url?: string | null;
          image_url?: string | null;
          image_candidates?: RecipeImageCandidate[];
        };
        error?: string;
      } | null;

      if (
        handleAiCreditsFailure(reportExhausted, {
          accountId,
          billingHref,
          status: response.status,
          body,
        })
      ) {
        return;
      }

      if (!response.ok || !body?.recipe) {
        toast.error(body?.error ?? 'Could not extract recipe');
        return;
      }

      const draft: RecipeFormDraft = {
        name: body.recipe.name,
        description: body.recipe.description,
        ingredients: body.recipe.ingredients,
        instructions: body.recipe.instructions,
        tags: body.recipe.tags,
        meal_type: body.recipe.meal_type,
        prep_minutes: body.recipe.prep_minutes,
        cook_minutes: body.recipe.cook_minutes,
        servings: body.recipe.servings,
        is_favorite: false,
        source_url:
          body.recipe.source_url ?? (source === 'url' ? payload : null),
        image_url: body.recipe.image_url ?? null,
        image_candidates: body.recipe.image_candidates ?? [],
      };

      toast.success('Recipe ready to review');
      handleOpenChange(false);
      onExtracted(draft);
    } catch {
      toast.error('Could not extract recipe');
    } finally {
      setIsExtracting(false);
    }
  }

  const canSubmit =
    source === 'text'
      ? text.trim().length >= 20
      : source === 'url'
        ? url.trim().length > 0
        : Boolean(imageDataUrl);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import recipe</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            Paste text, drop in a link (including Instagram), or upload a
            screenshot. You will review everything before it is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg border border-[color:var(--workspace-shell-border)] p-1">
          {SOURCE_TABS.map((tab) => {
            const active = source === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={isExtracting}
                onClick={() => setSource(tab.id)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors',
                  active
                    ? 'text-[var(--workspace-shell-text)]'
                    : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                )}
                style={active ? { backgroundColor: ACCENT } : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {source === 'text' ? (
            <div className="space-y-1.5">
              <Label htmlFor="recipe-import-text">Recipe text</Label>
              <Textarea
                id="recipe-import-text"
                rows={10}
                value={text}
                disabled={isExtracting}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste ingredients and method here…"
              />
            </div>
          ) : null}

          {source === 'url' ? (
            <div className="space-y-1.5">
              <Label htmlFor="recipe-import-url">Recipe link</Label>
              <Input
                id="recipe-import-url"
                type="url"
                inputMode="url"
                value={url}
                disabled={isExtracting}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://… or Instagram post/reel"
              />
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Works best when the recipe is written on the page or in the
                Instagram caption.
              </p>
            </div>
          ) : null}

          {source === 'image' ? (
            <div className="space-y-2">
              <Label htmlFor="recipe-import-image">Photo or screenshot</Label>
              <input
                ref={fileInputRef}
                id="recipe-import-image"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={isExtracting}
                className="hidden"
                onChange={(e) =>
                  void handleImageChange(e.target.files?.[0] ?? null)
                }
              />
              <button
                type="button"
                disabled={isExtracting}
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-10 text-sm text-[var(--workspace-shell-text-muted)] transition-colors hover:border-[color:var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
              >
                <ImageIcon className="h-6 w-6" />
                {imageName ? imageName : 'Choose image'}
              </button>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isExtracting}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleExtract()}
            disabled={isExtracting || !canSubmit}
            style={{ backgroundColor: ACCENT }}
            className="text-[var(--workspace-shell-text)] hover:opacity-90"
          >
            {isExtracting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Extracting…
              </>
            ) : (
              'Extract recipe'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
