import type { UnifiedPost } from '~/lib/feedflow/feed-types';
import { displayMediaForPost } from '~/lib/feedflow/instagram';

export const FEEDFLOW_EMBED_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export type FeedflowWidgetEmbedConfig = {
  columns_desktop: number | null;
  columns_tablet: number | null;
  columns_mobile: number | null;
  post_count: number | null;
  show_captions: boolean | null;
  gap: number | null;
  border_radius: number | null;
  accent_colour: string | null;
  custom_css: string | null;
  open_in: string | null;
  layout: string | null;
};

export function siteOriginFromEnv(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
}

export function feedflowEmbedUrl(origin: string, embedKey: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/api/feedflow/embed?widget=${encodeURIComponent(embedKey)}`;
}

export function feedflowEmbedScriptUrl(origin: string, embedKey: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/api/feedflow/embed/script?widget=${encodeURIComponent(embedKey)}`;
}

export function feedflowFeedJsonUrl(origin: string, embedKey: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/api/feedflow/feed?widget=${encodeURIComponent(embedKey)}`;
}

export function buildIframeEmbedSnippet(origin: string, embedKey: string): string {
  const src = feedflowEmbedUrl(origin, embedKey);
  return `<iframe src="${src}" title="Instagram feed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" style="border:0;width:100%;min-height:480px;"></iframe>`;
}

export function buildScriptEmbedSnippet(origin: string, embedKey: string): string {
  const src = feedflowEmbedScriptUrl(origin, embedKey);
  return `<div data-feedflow-widget="${embedKey}"></div>\n<script async src="${src}"></script>`;
}

export function buildEmbedLoaderScript(origin: string, embedKey: string): string {
  const src = feedflowEmbedUrl(origin, embedKey);
  const safeKey = JSON.stringify(embedKey);
  const safeSrc = JSON.stringify(src);

  return `(function(){
  var key = ${safeKey};
  var src = ${safeSrc};
  var mount = document.querySelector('[data-feedflow-widget="' + key + '"]') || document.currentScript && document.currentScript.parentNode;
  if (!mount) return;
  if (mount.getAttribute && mount.getAttribute('data-feedflow-ready') === '1') return;
  if (mount.setAttribute) mount.setAttribute('data-feedflow-ready', '1');
  var frame = document.createElement('iframe');
  frame.src = src;
  frame.title = 'Instagram feed';
  frame.loading = 'lazy';
  frame.referrerPolicy = 'no-referrer-when-downgrade';
  frame.setAttribute('style', 'border:0;width:100%;min-height:480px;display:block;');
  frame.setAttribute('data-feedflow-embed', key);
  window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (!data || data.source !== 'feedflow-embed' || data.widget !== key) return;
    if (typeof data.height === 'number' && data.height > 0) {
      frame.style.height = data.height + 'px';
      frame.style.minHeight = data.height + 'px';
    }
  });
  mount.appendChild(frame);
})();`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function columns(config: FeedflowWidgetEmbedConfig) {
  return {
    desktop: Math.min(6, Math.max(1, config.columns_desktop ?? 3)),
    tablet: Math.min(4, Math.max(1, config.columns_tablet ?? 2)),
    mobile: Math.min(3, Math.max(1, config.columns_mobile ?? 1)),
  };
}

export function renderFeedflowEmbedHtml(input: {
  embedKey: string;
  config: FeedflowWidgetEmbedConfig;
  posts: UnifiedPost[];
}): string {
  const cols = columns(input.config);
  const gap = Math.min(48, Math.max(0, input.config.gap ?? 8));
  const radius = Math.min(32, Math.max(0, input.config.border_radius ?? 0));
  const accent = input.config.accent_colour || '#111111';
  const showCaptions = Boolean(input.config.show_captions);
  const customCss = input.config.custom_css
    ? escapeHtml(input.config.custom_css)
    : '';

  const cards = input.posts
    .map((post) => {
      const display = displayMediaForPost({
        media_type: post.media_type,
        media_url: post.media_url,
        thumbnail_url: post.thumbnail_url,
      });
      const href = post.permalink || '#';
      const caption = post.caption ? escapeHtml(post.caption) : '';
      const src = escapeHtml(display.src);
      const play =
        display.isVideo || post.media_type === 'VIDEO'
          ? '<span class="ff-play" aria-hidden="true"></span>'
          : '';
      const captionHtml =
        showCaptions && caption
          ? `<p class="ff-caption">${caption}</p>`
          : '';

      return `<a class="ff-card" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
  <span class="ff-media">${src ? `<img src="${src}" alt="" loading="lazy" />` : '<span class="ff-empty">Post</span>'}${play}</span>
  ${captionHtml}
</a>`;
    })
    .join('\n');

  const empty = !input.posts.length
    ? '<p class="ff-empty-state">No posts yet. This feed updates automatically.</p>'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Instagram feed</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: transparent; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; color: #1a1a1a; }
    .ff-grid {
      display: grid;
      grid-template-columns: repeat(${cols.mobile}, minmax(0, 1fr));
      gap: ${gap}px;
    }
    @media (min-width: 640px) {
      .ff-grid { grid-template-columns: repeat(${cols.tablet}, minmax(0, 1fr)); }
    }
    @media (min-width: 960px) {
      .ff-grid { grid-template-columns: repeat(${cols.desktop}, minmax(0, 1fr)); }
    }
    .ff-card {
      display: block;
      color: inherit;
      text-decoration: none;
      border-radius: ${radius}px;
      overflow: hidden;
      background: #f4f4f4;
    }
    .ff-media {
      position: relative;
      display: block;
      aspect-ratio: 1 / 1;
      background: #ececec;
    }
    .ff-media img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .ff-play {
      position: absolute;
      inset: auto 10px 10px auto;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      background: ${escapeHtml(accent)};
      box-shadow: 0 0 0 3px rgba(255,255,255,0.7);
    }
    .ff-play:before {
      content: '';
      position: absolute;
      top: 8px;
      left: 11px;
      border-style: solid;
      border-width: 6px 0 6px 9px;
      border-color: transparent transparent transparent #fff;
    }
    .ff-caption {
      margin: 0;
      padding: 8px 10px 10px;
      font-size: 13px;
      line-height: 1.4;
      color: #222;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .ff-empty, .ff-empty-state {
      display: grid;
      place-items: center;
      min-height: 160px;
      color: #666;
      font-size: 14px;
      text-align: center;
      padding: 16px;
    }
    ${customCss}
  </style>
</head>
<body>
  <div class="ff-grid" data-feedflow-grid>${cards}</div>
  ${empty}
  <script>
    function reportHeight() {
      var height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ source: 'feedflow-embed', widget: ${JSON.stringify(input.embedKey)}, height: height }, '*');
      }
    }
    reportHeight();
    window.addEventListener('load', reportHeight);
    if (window.ResizeObserver) {
      new ResizeObserver(reportHeight).observe(document.body);
    }
  </script>
</body>
</html>`;
}
