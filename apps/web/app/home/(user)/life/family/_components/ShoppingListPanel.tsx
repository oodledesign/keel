'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Copy, Download, Plus, Share2, ShoppingCart } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  downloadTextFile,
  formatShoppingListCsv,
  formatShoppingListPlainText,
} from '~/lib/meals/shopping-export';
import {
  SHOPPING_CATEGORY_LABELS,
  SHOPPING_CATEGORY_ORDER,
} from '~/lib/meals/shopping-list-merge';
import { shoppingSyncStatusLabel } from '~/lib/meals/shopping-offline';

import {
  excludeShoppingItemAction,
  markShoppingItemPantryAction,
} from '../_lib/shopping-actions';
import type { ShoppingListWithItems } from '../_lib/schema/family-shopping.schema';
import { useShoppingListOffline } from '../_lib/use-shopping-list-offline';
import { ACCENT, panelClass } from './meal-ui';

const CATEGORY_ORDER = SHOPPING_CATEGORY_ORDER;

type Props = {
  list: ShoppingListWithItems | null;
  weekStart: string;
  mealPlanHref: string;
  accountSlug?: string;
  startAdding?: boolean;
};

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function weekRangeLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const fmt = (ymd: string) => {
    const [y, mo, da] = ymd.split('-').map(Number);
    return new Date(y!, mo! - 1, da!).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  };
  return `${fmt(weekStart)} – ${fmt(end)}`;
}

export function ShoppingListPanel({
  list: serverList,
  weekStart,
  mealPlanHref,
  accountSlug,
  startAdding = false,
}: Props) {
  const router = useRouter();
  const { list, status, toggleItem, addItem } = useShoppingListOffline({
    list: serverList,
    weekStart,
    accountSlug,
    mealPlanHref,
  });
  const [adding, setAdding] = useState(startAdding);
  const [draft, setDraft] = useState('');

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: (list?.items ?? []).filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);

  const remaining =
    list?.items.filter((item) => !item.checked && !item.excluded && !item.in_pantry)
      .length ?? 0;
  const total = list?.items.filter((item) => !item.excluded).length ?? 0;
  const statusLabel = shoppingSyncStatusLabel(status);
  const scopeFields = accountSlug ? { accountSlug } : {};

  async function handleAdd() {
    const added = await addItem(draft);
    if (added) {
      setDraft('');
      setAdding(false);
    }
  }

  async function handleCopy() {
    if (!list || list.items.length === 0) return;
    const text = formatShoppingListPlainText(list.items);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied shopping list');
    } catch {
      toast.error('Could not copy the list');
    }
  }

  async function handleShare() {
    if (!list || list.items.length === 0) return;
    const text = formatShoppingListPlainText(list.items);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Shopping list', text });
        return;
      } catch {
        // Fall through to copy if the share sheet is cancelled.
      }
    }
    await handleCopy();
  }

  function handleCsv() {
    if (!list || list.items.length === 0) return;
    downloadTextFile(
      `shopping-${list.week_start}.csv`,
      formatShoppingListCsv(list.items),
    );
  }

  if (!list) {
    return (
      <div className={cn(panelClass, 'px-5 py-8')}>
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <ShoppingCart className="h-8 w-8 text-[var(--workspace-shell-text-muted)]" />
          <h2 className="mt-3 text-base font-semibold text-[var(--workspace-shell-text)]">
            No shopping list yet
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            On the meal plan, tap Make shopping list after dinners are linked to
            recipes. Typed meals and leftovers do not add ingredients.
          </p>
          <Button
            asChild
            className="mt-4 text-[var(--workspace-shell-text)] hover:opacity-90"
            style={{ backgroundColor: ACCENT }}
          >
            <Link href={mealPlanHref}>Open meal plan</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Week of {weekRangeLabel(list.week_start)}
          </p>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {remaining} to buy · {total} items
            {statusLabel ? (
              <>
                {' · '}
                <span
                  data-test="shopping-sync-status"
                  className="text-[var(--workspace-shell-text)]"
                >
                  {statusLabel}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={mealPlanHref}>Meal plan</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleCopy()}
            data-test="shopping-copy"
          >
            <Copy className="mr-1.5 h-4 w-4" />
            Copy list
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleShare()}
          >
            <Share2 className="mr-1.5 h-4 w-4" />
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={handleCsv}>
            <Download className="mr-1.5 h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdding(true)}
            data-test="shopping-add"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add item
          </Button>
        </div>
      </div>

      {list.skipped_meals.length > 0 ? (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          Skipped (no recipe ingredients): {list.skipped_meals.join(', ')}. Link
          a recipe on those days, or leave leftovers as typed meals.
        </p>
      ) : null}

      {adding ? (
        <div className={cn(panelClass, 'flex items-center gap-2 p-3')}>
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAdd();
              if (e.key === 'Escape') setAdding(false);
            }}
            placeholder="e.g. 2 onions"
            className="h-9 text-sm"
            data-test="shopping-add-input"
          />
          <Button
            size="sm"
            onClick={() => void handleAdd()}
            disabled={!draft.trim()}
            style={{ backgroundColor: ACCENT }}
            className="h-9 text-[var(--workspace-shell-text)] hover:opacity-90"
          >
            Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAdding(false)}
            className="h-9 text-[var(--workspace-shell-text-muted)]"
          >
            Cancel
          </Button>
        </div>
      ) : null}

      <div
        className={cn(
          panelClass,
          'divide-y divide-[color:var(--workspace-shell-border)]',
        )}
      >
        {grouped.map((group) => (
          <section key={group.category} className="px-4 py-3">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              {SHOPPING_CATEGORY_LABELS[group.category]}
            </h3>
            <ul className="space-y-1.5">
              {group.items.map((item) => {
                const checked = item.checked;
                const dimmed = checked || item.in_pantry || item.excluded;
                return (
                  <li key={item.id}>
                    <div
                      className={cn(
                        'flex items-start gap-3 rounded-lg px-1 py-1.5',
                        dimmed && 'opacity-50',
                      )}
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            void toggleItem(item.id, value === true)
                          }
                          className="mt-0.5"
                          data-test={`shopping-item-${item.id}`}
                        />
                        <span
                          className={cn(
                            'text-sm text-[var(--workspace-shell-text)]',
                            checked && 'line-through',
                          )}
                        >
                          {item.display_text}
                          {item.in_pantry ? (
                            <span className="ml-2 text-[11px] text-[var(--workspace-shell-text-muted)]">
                              We have this
                            </span>
                          ) : null}
                        </span>
                      </label>
                      <button
                        type="button"
                        className="shrink-0 text-[11px] text-[var(--workspace-shell-text-muted)] hover:underline"
                        onClick={() => {
                          void markShoppingItemPantryAction({
                            itemId: item.id,
                            inPantry: !item.in_pantry,
                            ...scopeFields,
                          }).then((result) => {
                            if (!result.success) {
                              toast.error(result.error);
                              return;
                            }
                            router.refresh();
                          });
                        }}
                      >
                        {item.in_pantry ? 'Need' : 'Have'}
                      </button>
                      <button
                        type="button"
                        className="shrink-0 text-[11px] text-[var(--workspace-shell-text-muted)] hover:underline"
                        onClick={() => {
                          void excludeShoppingItemAction({
                            itemId: item.id,
                            excluded: !item.excluded,
                            ...scopeFields,
                          }).then((result) => {
                            if (!result.success) {
                              toast.error(result.error);
                              return;
                            }
                            router.refresh();
                          });
                        }}
                      >
                        {item.excluded ? 'Include' : 'Skip'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
        Tick items as you shop. Amounts scale to household size in Preferences.
        Rebuild list on the meal plan replaces this week&apos;s items.
      </p>
    </div>
  );
}
