import { NextResponse } from 'next/server';

import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';

import { suggestUkAddresses } from '~/lib/commercial/address-suggest';

const QuerySchema = z.object({
  q: z.string().trim().min(3).max(200),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

/**
 * GET /api/commercial/address-suggest?q=…
 * Authenticated UK address autocomplete (Mapbox).
 */
export const GET = enhanceRouteHandler(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      q: searchParams.get('q') ?? '',
      limit: searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ suggestions: [] });
    }

    try {
      const suggestions = await suggestUkAddresses(
        parsed.data.q,
        parsed.data.limit ?? 6,
      );
      return NextResponse.json({ suggestions });
    } catch (err) {
      console.error('[address-suggest] route failed', err);
      return NextResponse.json({ error: 'upstream_error' }, { status: 503 });
    }
  },
  { auth: true },
);
