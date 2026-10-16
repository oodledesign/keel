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
  preview: z.literal('1').optional(),
  layout: z.enum(['grid', 'slider']).optional(),
  posts: z.coerce.number().int().min(1).max(12).optional(),
  ratio: z.enum(['square', 'portrait']).optional(),
  likes: z.enum(['0', '1']).optional(),
  videos: z.enum(['0', '1']).optional(),
  reveal: z.enum(['none', 'fade', 'rise', 'cascade', 'scale']).optional(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Security-Policy':
    "default-src 'none'; img-src https: data:; media-src https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors *;",
  'X-Content-Type-Options': 'nosniff',
};

function embedCacheControl(preview: boolean) {
  return preview
    ? 'private, no-store'
    : 'public, max-age=0, s-maxage=0, must-revalidate';
}

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
      headers: {
        ...corsHeaders,
        'Cache-Control': 'private, no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  const admin = createFeedflowAdminClient();
  const { data: widget, error } = await admin
    .from('widgets')
    .select(
      'id, embed_key, layout, post_count, show_captions, show_likes, play_videos, tile_ratio, reveal_animation, gap, border_radius, columns_desktop, columns_tablet, columns_mobile, accent_colour, custom_css, open_in, social_account_id',
    )
    .eq('embed_key', parsed.data.widget)
    .maybeSingle();

  const preview = parsed.data.preview === '1';

  if (error || !widget || !widget.social_account_id) {
    return new NextResponse(renderEmpty('Widget not found'), {
      status: 404,
      headers: {
        ...corsHeaders,
        'Cache-Control': embedCacheControl(preview),
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }

  const config = widget as FeedflowWidgetEmbedConfig;
  if (preview) {
    if (parsed.data.layout) config.layout = parsed.data.layout;
    if (parsed.data.posts) config.post_count = parsed.data.posts;
    if (parsed.data.ratio) config.tile_ratio = parsed.data.ratio;
    if (parsed.data.likes) config.show_likes = parsed.data.likes === '1';
    if (parsed.data.videos) config.play_videos = parsed.data.videos === '1';
    if (parsed.data.reveal) config.reveal_animation = parsed.data.reveal;
  }

  try {
    const limit = Math.min(30, config.post_count ?? 9);
    const { posts } = await getOrRefreshFeedForAccount(
      widget.social_account_id as string,
      limit,
    );

    const html = renderFeedflowEmbedHtml({
      embedKey: widget.embed_key as string,
      config,
      posts: posts.slice(0, limit),
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': embedCacheControl(preview),
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Feed error';
    return new NextResponse(renderEmpty(msg), {
      status: 502,
      headers: {
        ...corsHeaders,
        'Cache-Control': embedCacheControl(preview),
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }
}

function renderEmpty(message: string) {
  const safe = message
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Feedflow</title></head><body style="font-family:system-ui;padding:24px;color:#555">${safe}</body></html>`;
}
