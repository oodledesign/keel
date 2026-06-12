import { FamilyPageClient } from './_components/FamilyPageClient';
import { loadFamilyMealData } from './_lib/server/family-meal.loader';
import type { MealPlanView } from './_lib/schema/family-meal.schema';

export const dynamic = 'force-dynamic';

type FamilyPageProps = {
  searchParams: Promise<{ week?: string; month?: string; view?: string }>;
};

function parseView(value: string | undefined): MealPlanView {
  return value === 'month' ? 'month' : 'week';
}

export default async function FamilyPage({ searchParams }: FamilyPageProps) {
  const { week, month, view: viewParam } = await searchParams;
  const view = parseView(viewParam);

  const weekStart =
    view === 'week' && /^\d{4}-\d{2}-\d{2}$/.test(week ?? '')
      ? week
      : undefined;

  const monthKey =
    view === 'month' && /^\d{4}-\d{2}$/.test(month ?? '') ? month : undefined;

  const data = await loadFamilyMealData({ view, weekStart, monthKey });

  return <FamilyPageClient initialData={data} />;
}
