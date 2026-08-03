import { type NextRequest, NextResponse } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { buildPersonalShortcutCatalog } from '~/lib/dashboard-shortcuts/build-catalog';
import { catalogItemHref } from '~/lib/dashboard-shortcuts/resolve-href';
import { catalogItemKey } from '~/lib/dashboard-shortcuts/types';
import type { NavSearchItem } from '~/lib/quick-action/filter-nav-catalog';
import { rateLimitApiRequest } from '~/lib/rate-limit/api-rate-limit';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const limited = rateLimitApiRequest(request, {
      scope: 'quick-action-nav-catalog',
      limit: 60,
      subject: user.id,
    });
    if (limited) return limited;

    const catalog = await buildPersonalShortcutCatalog(client, user.id);
    const seen = new Set<string>();
    const items: NavSearchItem[] = [];

    for (const entry of catalog) {
      const href = catalogItemHref(entry);
      if (!href) continue;

      const id = catalogItemKey(entry);
      if (seen.has(id) || seen.has(href)) continue;
      seen.add(id);
      seen.add(href);

      items.push({
        id,
        label: entry.label,
        description: entry.description,
        category: entry.category,
        href,
        keywords: entry.keywords,
      });
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error('quick-action nav-catalog failed', error);
    return NextResponse.json(
      { error: 'Could not load search catalog' },
      { status: 500 },
    );
  }
}
