import { Sparkles } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import type { RecipeMealType } from '../_lib/schema/family-meal.schema';
import { mealTypeLabels, titleCase } from './meal-ui';

const badgeBase =
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium';

export const recipeBadgeClass = {
  aiGenerated: cn(
    badgeBase,
    'bg-[var(--ozer-badge-ai-generated-bg)] text-[var(--ozer-badge-ai-generated-fg)]',
  ),
  mealType: cn(
    badgeBase,
    'bg-[var(--ozer-badge-meal-type-bg)] text-[var(--ozer-badge-meal-type-fg)] capitalize',
  ),
  cuisineTag: cn(
    badgeBase,
    'bg-[var(--ozer-badge-cuisine-tag-bg)] text-[var(--ozer-badge-cuisine-tag-fg)] capitalize',
  ),
} as const;

type RecipeBadgesProps = {
  source?: 'manual' | 'ai';
  mealType?: RecipeMealType | string | null;
  tags?: string[];
  dietTags?: string[];
  maxTags?: number;
  className?: string;
};

export function RecipeBadges({
  source,
  mealType,
  tags = [],
  dietTags = [],
  maxTags = 6,
  className,
}: RecipeBadgesProps) {
  const cuisineTags = [...dietTags, ...tags].slice(0, maxTags);

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {source === 'ai' ? (
        <span className={recipeBadgeClass.aiGenerated}>
          <Sparkles className="h-3 w-3" />
          AI generated
        </span>
      ) : null}

      {mealType ? (
        <span className={recipeBadgeClass.mealType}>
          {mealTypeLabels[mealType as RecipeMealType] ?? titleCase(mealType)}
        </span>
      ) : null}

      {cuisineTags.map((tag) => (
        <span key={tag} className={recipeBadgeClass.cuisineTag}>
          {titleCase(tag)}
        </span>
      ))}
    </div>
  );
}
