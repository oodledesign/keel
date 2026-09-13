'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import {
  ArrowLeft,
  ChefHat,
  Minus,
  Pause,
  Play,
  Plus,
  Timer,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import {
  type MeasurementSystem,
  formatIngredientDisplay,
  renderStepContent,
} from '~/lib/meals/recipe-measurements';

import { buildRecipeDetailPath } from '../_lib/family-meal.paths';
import type {
  RecipeRow,
  RecipeStructure,
} from '../_lib/schema/family-meal.schema';
import { ACCENT, panelClass } from './meal-ui';

type Props = {
  recipe: RecipeRow;
  structure: RecipeStructure;
  basePath: string;
};

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function RecipeCookMode({ recipe, structure, basePath }: Props) {
  const defaultServings = Math.max(1, recipe.servings ?? 1);
  const [servings, setServings] = useState(defaultServings);
  const [stepIndex, setStepIndex] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const system: MeasurementSystem = 'metric';
  const servingsScale = servings / defaultServings;
  const backHref = buildRecipeDetailPath(basePath, recipe.id);

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
    for (const ingredient of structure.ingredients) {
      map.set(ingredient.id, {
        name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
        original_text: ingredient.original_text,
      });
    }
    return map;
  }, [structure.ingredients]);

  const steps = useMemo(() => {
    if (structure.steps.length === 0) {
      const fallback = recipe.instructions?.trim();
      if (!fallback) return [];
      return [
        {
          id: 'fallback',
          title: 'Method',
          timer_seconds: null as number | null,
          content: fallback,
        },
      ];
    }

    return structure.steps.map((step) => ({
      id: step.id,
      title: step.title,
      timer_seconds: step.timer_seconds,
      content: renderStepContent({
        content: step.content,
        ingredientsById,
        stepMultipliers: new Map(Object.entries(step.ingredient_multipliers)),
        servingsScale,
        system,
        includeAmount: true,
      }),
    }));
  }, [
    structure.steps,
    recipe.instructions,
    ingredientsById,
    servingsScale,
    system,
  ]);

  const current = steps[stepIndex] ?? null;

  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        sentinel = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        sentinel = null;
      }
    };
    void request();
    return () => {
      void sentinel?.release();
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const handle = window.setInterval(() => {
      setRemaining((value) => {
        if (value == null || value <= 0) {
          setRunning(false);
          return 0;
        }
        const next = value - 1;
        if (next <= 0) setRunning(false);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(handle);
  }, [running]);

  function startTimer(seconds: number) {
    setRemaining(seconds);
    setRunning(true);
  }

  const scaledIngredients =
    structure.ingredients.length > 0
      ? structure.ingredients.map((ingredient) =>
          formatIngredientDisplay({
            name: ingredient.name,
            amount: ingredient.amount,
            unit: ingredient.unit,
            original_text: ingredient.original_text,
            servingsScale,
            system,
          }),
        )
      : servingsScale === 1
        ? recipe.ingredients
        : recipe.ingredients.map(
            (line) =>
              `${line} (×${servingsScale.toFixed(2).replace(/\.?0+$/, '')})`,
          );

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col gap-6 px-4 py-6 text-[var(--workspace-shell-text)] md:px-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Exit cook mode
        </Link>
        <div className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text-muted)]">
          <ChefHat className="h-4 w-4" />
          Screen stays on
        </div>
      </div>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{recipe.name}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-[var(--workspace-shell-text-muted)]">
            Servings
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              aria-label="Fewer servings"
              disabled={servings <= 1}
              onClick={() => setServings((value) => Math.max(1, value - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-10 text-center text-lg font-semibold tabular-nums">
              {servings}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              aria-label="More servings"
              disabled={servings >= 50}
              onClick={() => setServings((value) => Math.min(50, value + 1))}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {current ? (
        <section className={cn(panelClass, 'space-y-4 p-6')}>
          <p className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
            Step {stepIndex + 1} of {steps.length}
            {current.title ? ` · ${current.title}` : ''}
          </p>
          <p className="text-2xl leading-snug font-medium whitespace-pre-wrap">
            {current.content}
          </p>
          {current.timer_seconds && current.timer_seconds > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => startTimer(current.timer_seconds ?? 0)}
                style={{ backgroundColor: ACCENT }}
                className="text-[var(--ozer-white)] hover:opacity-90"
              >
                <Timer className="mr-1.5 h-4 w-4" />
                Start {Math.round((current.timer_seconds ?? 0) / 60)} min timer
              </Button>
            </div>
          ) : null}
          {remaining != null ? (
            <div className="flex items-center gap-3 text-lg font-semibold tabular-nums">
              <span>{formatTimer(remaining)}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRunning((value) => !value)}
              >
                {running ? (
                  <Pause className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                )}
                {running ? 'Pause' : 'Resume'}
              </Button>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={stepIndex === 0}
              onClick={() => {
                setStepIndex((value) => Math.max(0, value - 1));
                setRemaining(null);
                setRunning(false);
              }}
            >
              Previous
            </Button>
            <Button
              type="button"
              disabled={stepIndex >= steps.length - 1}
              onClick={() => {
                setStepIndex((value) => Math.min(steps.length - 1, value + 1));
                setRemaining(null);
                setRunning(false);
              }}
              style={{ backgroundColor: ACCENT }}
              className="text-[var(--ozer-white)] hover:opacity-90"
            >
              Next step
            </Button>
          </div>
        </section>
      ) : (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          This recipe has no method yet.
        </p>
      )}

      <section className={cn(panelClass, 'p-5')}>
        <h2 className="text-sm font-semibold">Ingredients for {servings}</h2>
        {scaledIngredients.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm text-[var(--workspace-shell-text-muted)]">
            {scaledIngredients.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
            No ingredients listed.
          </p>
        )}
      </section>
    </div>
  );
}
