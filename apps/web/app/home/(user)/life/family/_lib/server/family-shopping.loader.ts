import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { ShoppingListWithItems } from '../schema/family-shopping.schema';
import { mondayWeekStart } from './family-meal.dates';
import { resolveMealPlanScope } from './family-meal.scope';
import { createFamilyShoppingService } from './family-shopping.service';

export const loadFamilyShoppingList = cache(
  async (options: {
    accountSlug?: string;
    weekStart?: string;
  }): Promise<{
    list: ShoppingListWithItems | null;
    weekStart: string;
    accountSlug?: string;
  }> => {
    const scope = await resolveMealPlanScope(options.accountSlug);
    const weekStart = options.weekStart ?? mondayWeekStart();
    const service = createFamilyShoppingService(getSupabaseServerClient());

    const list = options.weekStart
      ? await service.loadLatestList(scope, options.weekStart)
      : await service.loadLatestList(scope);

    return {
      list,
      weekStart: list?.week_start ?? weekStart,
      accountSlug: scope.kind === 'workspace' ? scope.accountSlug : undefined,
    };
  },
);
