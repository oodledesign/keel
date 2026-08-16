'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Star } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { logRecipeCookAction } from '../_lib/actions';
import type {
  RecipeCookLogRow,
  RecipePopularityStats,
} from '../_lib/schema/family-meal.schema';
import { panelClass } from './meal-ui';

type Props = {
  recipeId: string;
  accountSlug?: string;
  popularity: RecipePopularityStats;
  recentLogs: RecipeCookLogRow[];
};

function formatCookedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function RecipeCookLogPanel({
  recipeId,
  accountSlug,
  popularity,
  recentLogs,
}: Props) {
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();

  function handleLog() {
    startTransition(async () => {
      const result = await logRecipeCookAction({
        recipeId,
        rating,
        notes: notes.trim() ? notes.trim() : null,
        ...(accountSlug ? { accountSlug } : {}),
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(rating ? `Logged cook · ${rating}★` : 'Cook logged');
      setRating(null);
      setNotes('');
      router.refresh();
    });
  }

  const avgLabel =
    popularity.avg_rating == null
      ? null
      : `${popularity.avg_rating.toFixed(1)}★ average`;

  return (
    <section className={cn(panelClass, 'space-y-4 p-5')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Cook history
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            {popularity.times_cooked === 0
              ? 'Not cooked yet — log a cook to improve meal planning.'
              : [
                  `Cooked ${popularity.times_cooked} time${popularity.times_cooked === 1 ? '' : 's'}`,
                  avgLabel,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((value) => {
            const active = rating != null && rating >= value;
            return (
              <button
                key={value}
                type="button"
                aria-label={`Rate ${value} star${value === 1 ? '' : 's'}`}
                onClick={() =>
                  setRating((current) => (current === value ? null : value))
                }
                className="rounded-md p-1 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
              >
                <Star
                  className={cn(
                    'h-5 w-5',
                    active
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-[var(--workspace-shell-text-muted)]',
                  )}
                />
              </button>
            );
          })}
          <span className="ml-1 text-xs text-[var(--workspace-shell-text-muted)]">
            Optional rating
          </span>
        </div>

        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notes from tonight (optional)"
          className="min-h-[72px] resize-y"
          maxLength={1_000}
        />

        <Button
          type="button"
          size="sm"
          onClick={handleLog}
          disabled={pending}
          className="h-8"
        >
          {pending ? 'Saving…' : 'Log cook'}
        </Button>
      </div>

      {recentLogs.length > 0 ? (
        <ul className="space-y-2 border-t border-[var(--workspace-shell-border)] pt-4">
          {recentLogs.map((log) => (
            <li
              key={log.id}
              className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-[var(--workspace-shell-text-muted)]"
            >
              <span>{formatCookedAt(log.cooked_at)}</span>
              <span className="flex items-center gap-2">
                {log.rating != null ? (
                  <span className="inline-flex items-center gap-1 text-[var(--workspace-shell-text)]">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {log.rating}
                  </span>
                ) : (
                  <span>No rating</span>
                )}
              </span>
              {log.notes ? (
                <span className="line-clamp-4 w-full text-[var(--workspace-shell-text-muted)]">
                  {log.notes}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
