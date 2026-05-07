import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createFeedflowAdminClient } from '~/lib/feedflow/admin';
import { getOrRefreshFeedForAccount } from '~/lib/feedflow/feed-cache';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  widget: z.string().min(1),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid widget key' },
      { status: 400, headers: corsHeaders },
    );
  }

  const admin = createFeedflowAdminClient();
  const { data: widget, error } = await admin
    .from('widgets')
    .select(
      'id, embed_key, layout, post_count, show_captions, show_likes, open_in, gap, border_radius, columns_desktop, columns_tablet, columns_mobile, slider_autoplay, slider_autoplay_speed, accent_colour, custom_css, social_account_id',
    )
    .eq('embed_key', parsed.data.widget)
    .maybeSingle();

  if (error || !widget || !widget.social_account_id) {
    return NextResponse.json(
      { error: 'Widget not found' },
      { status: 404, headers: corsHeaders },
    );
  }

  const { data: social } = await admin
    .from('social_accounts')
    .select('platform, provider')
    .eq('id', widget.social_account_id)
    .single();

  try {
    const { posts, platform } = await getOrRefreshFeedForAccount(
      widget.social_account_id as string,
      Math.min(30, widget.post_count ?? 9),
    );
    const limit = Math.min(30, widget.post_count ?? 9);
    const sliced = posts.slice(0, limit);

    const plat =
      social?.platform ?? social?.provider ?? platform;

    return NextResponse.json(
      {
        widgetId: widget.id,
        platform: plat,
        layout: widget.layout,
        config: {
          columns_desktop: widget.columns_desktop,
          columns_tablet: widget.columns_tablet,
          columns_mobile: widget.columns_mobile,
          post_count: widget.post_count,
          show_captions: widget.show_captions,
          show_likes: widget.show_likes,
          gap: widget.gap,
          border_radius: widget.border_radius,
          open_in: widget.open_in,
          slider_autoplay: widget.slider_autoplay,
          slider_autoplay_speed: widget.slider_autoplay_speed,
          accent_colour: widget.accent_colour,
          custom_css: widget.custom_css,
        },
        posts: sliced,
      },
      { headers: corsHeaders },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Feed error';
    return NextResponse.json(
      { error: msg },
      { status: 502, headers: corsHeaders },
    );
  }
}
