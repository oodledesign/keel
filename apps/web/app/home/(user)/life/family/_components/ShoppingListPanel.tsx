'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Copy, Plus, ShoppingCart } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  SHOPPING_CATEGORY_LABELS,
  SHOPPING_CATEGORY_ORDER,
} from '~/lib/meals/shopping-list-merge';

import type {
  ShoppingListItemRow,
  ShoppingListWithItems,
} from '../_lib/schema/family-shopping.schema';
import {
  addShoppingItemAction,
  toggleShoppingItemAction,
} from '../_lib/shopping-actions';
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
  list,
  weekStart,
  mealPlanHref,
  accountSlug,
  startAdding = false,
}: Props) {
  const router = useRouter();
  const scopeFields = accountSlug ? { accountSlug } : {};
  const [adding, setAdding] = useState(startAdding);
  const [draft, setDraft] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const grouped = useMemo(() => {
    const items = list?.items ?? [];
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    })).filter((group) => group.items.length > 0);
  }, [list?.items]);

  const remaining = list?.items.filter((item) => !item.checked).length ?? 0;
  const total = list?.items.length ?? 0;

  async function handleToggle(item: ShoppingListItemRow, checked: boolean) {
    setPendingId(item.id);
    try {
      const result = await toggleShoppingItemAction({
        itemId: item.id,
        checked,
        ...scopeFields,
      });
      if (!result.success) throw new Error(result.error);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update item');
    } finally {
      setPendingId(null);
    }
  }

  async function handleAdd() {
    const text = draft.trim();
    if (!text) return;
    setIsAdding(true);
    try {
      const result = await addShoppingItemAction({
        listId: list?.id,
        weekStart: list?.week_start ?? weekStart,
        text,
        ...scopeFields,
      });
      if (!result.success) throw new Error(result.error);
      setDraft('');
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add item');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleCopy() {
    if (!list || list.items.length === 0) return;
    const text = list.items
      .map((item) => `${item.checked ? '☑' : '☐'} ${item.display_text}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied shopping list');
    } catch {
      toast.error('Could not copy the list');
    }
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
            Generate one from this week&apos;s meal plan to merge every
            ingredient and how much you need.
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
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          No ingredients for: {list.skipped_meals.join(', ')}
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
            disabled={isAdding || !draft.trim()}
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
                return (
                  <li key={item.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg px-1 py-1.5',
                        checked && 'opacity-60',
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={pendingId === item.id}
                        onCheckedChange={(value) =>
                          void handleToggle(item, value === true)
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
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
        Tick items as you shop. Regenerating from the meal plan replaces this
        week&apos;s list.
      </p>
    </div>
  );
}
