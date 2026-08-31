import { type NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { createFeedflowAdminClient } from '~/lib/feedflow/admin';
import {
  FEEDFLOW_EMBED_KEY_PATTERN,
  type FeedflowWidgetEmbedConfig,
  renderFeedflowEmbedHtml,
} from '~/lib/feedflow/embed';
import { getOrRefreshFeedForAccount } from '~/lib/feedflow/feed-cache';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  widget: z.string().regex(FEEDFLOW_EMBED_KEY_PATTERN),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
  'Content-Security-Policy':
    "default-src 'none'; img-src https: data:; media-src https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors *;",
  'X-Content-Type-Options': 'nosniff',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return new NextResponse('Invalid widget key', {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const admin = createFeedflowAdminClient();
  const { data: widget, error } = await admin
    .from('widgets')
    .select(
      'id, embed_key, layout, post_count, show_captions, gap, border_radius, columns_desktop, columns_tablet, columns_mobile, accent_colour, custom_css, open_in, social_account_id',
    )
    .eq('embed_key', parsed.data.widget)
    .maybeSingle();

  if (error || !widget || !widget.social_account_id) {
    return new NextResponse(renderEmpty('Widget not found'), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    const limit = Math.min(30, widget.post_count ?? 9);
    const { posts } = await getOrRefreshFeedForAccount(
      widget.social_account_id as string,
      limit,
    );

    const html = renderFeedflowEmbedHtml({
      embedKey: widget.embed_key as string,
      config: widget as FeedflowWidgetEmbedConfig,
      posts: posts.slice(0, limit),
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Feed error';
    return new NextResponse(renderEmpty(msg), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

function renderEmpty(message: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Feedflow</title></head><body style="font-family:system-ui;padding:24px;color:#555">${message}</body></html>`;
}
