'use client';

import { useMemo, useState } from 'react';

import { Minus, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import {
  formatIngredientDisplay,
  type MeasurementSystem,
  renderStepContent,
} from '~/lib/meals/recipe-measurements';

import type {
  RecipeIngredientRow,
  RecipeStepRow,
} from '../_lib/schema/family-meal.schema';
import { panelClass } from './meal-ui';

type Props = {
  baseServings: number | null;
  ingredients: RecipeIngredientRow[];
  steps: RecipeStepRow[];
  /** Fallback free-text lines when structured ingredients are empty */
  fallbackIngredients: string[];
  /** Fallback method text when structured steps are empty */
  fallbackInstructions: string | null;
};

export function RecipeMethodPanel({
  baseServings,
  ingredients,
  steps,
  fallbackIngredients,
  fallbackInstructions,
}: Props) {
  const defaultServings = Math.max(1, baseServings ?? 1);
  const [servings, setServings] = useState(defaultServings);
  const [system, setSystem] = useState<MeasurementSystem>('metric');

  const servingsScale = servings / defaultServings;

  const ingredientsById = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        amount: number | null;
        unit: string | null;
        original_text: string;
      }
    >();
    for (const ingredient of ingredients) {
      map.set(ingredient.id, {
        name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
        original_text: ingredient.original_text,
      });
    }
    return map;
  }, [ingredients]);

  const scaledIngredients = useMemo(() => {
    if (ingredients.length === 0) {
      return fallbackIngredients;
    }

    return ingredients.map((ingredient) =>
      formatIngredientDisplay({
        name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
        original_text: ingredient.original_text,
        servingsScale,
        system,
      }),
    );
  }, [ingredients, fallbackIngredients, servingsScale, system]);

  const renderedSteps = useMemo(() => {
    if (steps.length === 0) {
      return null;
    }

    return steps.map((step) => {
      const multipliers = new Map(
        Object.entries(step.ingredient_multipliers),
      );
      return {
        id: step.id,
        title: step.title,
        timer_seconds: step.timer_seconds,
        content: renderStepContent({
          content: step.content,
          ingredientsById,
          stepMultipliers: multipliers,
          servingsScale,
          system,
        }),
      };
    });
  }, [steps, ingredientsById, servingsScale, system]);

  return (
    <div className="space-y-4">
      <div
        className={cn(
          panelClass,
          'flex flex-wrap items-center justify-between gap-3 p-4',
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--workspace-shell-text-muted)]">
            Servings
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Fewer servings"
              disabled={servings <= 1}
              onClick={() => setServings((value) => Math.max(1, value - 1))}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-8 text-center text-sm font-medium tabular-nums text-[var(--workspace-shell-text)]">
              {servings}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="More servings"
              disabled={servings >= 50}
              onClick={() => setServings((value) => Math.min(50, value + 1))}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-[color:var(--workspace-shell-border)] p-0.5">
          {(['metric', 'imperial'] as const).map((option) => {
            const active = system === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setSystem(option)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
                  active
                    ? 'bg-[var(--ozer-badge-meal-type-bg)] text-[var(--ozer-badge-meal-type-fg)]'
                    : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={cn(panelClass, 'p-5')}>
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Ingredients
          </h2>
          {scaledIngredients.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-[var(--workspace-shell-text-muted)]">
              {scaledIngredients.map((item, index) => (
                <li key={`${index}-${item}`} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#FFE3DA]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
              No ingredients listed.
            </p>
          )}
        </section>

        <section className={cn(panelClass, 'p-5')}>
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Method
          </h2>
          {renderedSteps ? (
            <ol className="mt-3 space-y-4">
              {renderedSteps.map((step, index) => (
                <li key={step.id} className="space-y-1.5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text)] uppercase">
                      {step.title || `Step ${index + 1}`}
                    </span>
                    {step.timer_seconds != null && step.timer_seconds > 0 ? (
                      <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
                        {Math.round(step.timer_seconds / 60)} min
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--workspace-shell-text-muted)]">
                    {step.content}
                  </p>
                </li>
              ))}
            </ol>
          ) : fallbackInstructions?.trim() ? (
            <div className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-[var(--workspace-shell-text-muted)]">
              {fallbackInstructions}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
              No instructions yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
