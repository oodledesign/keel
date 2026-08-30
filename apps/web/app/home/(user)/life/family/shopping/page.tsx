import { withI18n } from '~/lib/i18n/with-i18n';

import { ShoppingListPanel } from '../_components/ShoppingListPanel';
import { loadFamilyShoppingList } from '../_lib/server/family-shopping.loader';

export const dynamic = 'force-dynamic';

type PersonalShoppingPageProps = {
  searchParams: Promise<{ week?: string; create?: string }>;
};

async function PersonalFamilyShoppingPage({
  searchParams,
}: PersonalShoppingPageProps) {
  const { week, create } = await searchParams;
  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(week ?? '') ? week : undefined;
  const data = await loadFamilyShoppingList({ weekStart });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 bg-transparent px-4 pt-6 pb-12 text-[var(--workspace-shell-text)] md:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Shopping
        </h1>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Merged groceries from this week&apos;s meal plan.
        </p>
      </div>
      <ShoppingListPanel
        list={data.list}
        weekStart={data.weekStart}
        mealPlanHref={`/app/life/family?view=week&week=${data.weekStart}`}
        startAdding={create === 'item'}
      />
    </div>
  );
}

export default withI18n(PersonalFamilyShoppingPage);
