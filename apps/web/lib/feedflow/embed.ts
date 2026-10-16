import type { UnifiedPost } from '~/lib/feedflow/feed-types';
import { displayMediaForPost } from '~/lib/feedflow/instagram-display';

export const FEEDFLOW_EMBED_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export type FeedflowWidgetEmbedConfig = {
  columns_desktop: number | null;
  columns_tablet: number | null;
  columns_mobile: number | null;
  post_count: number | null;
  show_captions: boolean | null;
  show_likes: boolean | null;
  play_videos: boolean | null;
  tile_ratio: string | null;
  reveal_animation: string | null;
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

export function feedflowEmbedScriptUrl(
  origin: string,
  embedKey: string,
): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/api/feedflow/embed/script?widget=${encodeURIComponent(embedKey)}`;
}

export function feedflowFeedJsonUrl(origin: string, embedKey: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/api/feedflow/feed?widget=${encodeURIComponent(embedKey)}`;
}

export function buildIframeEmbedSnippet(
  origin: string,
  embedKey: string,
): string {
  const src = JSON.stringify(feedflowEmbedUrl(origin, embedKey));
  const key = escapeHtml(embedKey);
  return `<iframe title="Instagram feed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" style="border:0;width:100%;min-height:480px;display:block;" data-feedflow-embed="${key}"></iframe>
<script>
(function(){
  var frame = document.currentScript && document.currentScript.previousElementSibling;
  if (!frame) return;
  var src = ${src};
  function show(){ if (!frame.getAttribute('src')) frame.setAttribute('src', src); }
  if (!('IntersectionObserver' in window)) { show(); return; }
  var io = new IntersectionObserver(function(entries){
    if (entries.some(function(entry){ return entry.isIntersecting; })) { show(); io.disconnect(); }
  }, { threshold: 0.15 });
  io.observe(frame);
})();
</script>`;
}

export function buildScriptEmbedSnippet(
  origin: string,
  embedKey: string,
): string {
  const src = feedflowEmbedScriptUrl(origin, embedKey);
  return `<div data-feedflow-widget="${embedKey}"></div>\n<script async src="${src}"></script>`;
}

export function buildEmbedLoaderScript(
  origin: string,
  embedKey: string,
): string {
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
  frame.title = 'Instagram feed';
  frame.loading = 'lazy';
  frame.referrerPolicy = 'no-referrer-when-downgrade';
  frame.setAttribute('style', 'border:0;width:100%;min-height:480px;display:block;');
  frame.setAttribute('data-feedflow-embed', key);
  function showFrame() {
    if (frame.getAttribute('src')) return;
    frame.src = src;
  }
  if (!('IntersectionObserver' in window)) showFrame();
  else {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (entry) { return entry.isIntersecting; })) {
        showFrame();
        io.disconnect();
      }
    }, { threshold: 0.15 });
    io.observe(frame);
  }
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

function httpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  }
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(value);
}

const REVEAL_MODES = ['none', 'fade', 'rise', 'cascade', 'scale'] as const;

function revealMode(value: string | null | undefined) {
  return (REVEAL_MODES as readonly string[]).includes(value ?? '')
    ? (value as (typeof REVEAL_MODES)[number])
    : 'none';
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
  const showLikes = Boolean(input.config.show_likes);
  const playVideos = Boolean(input.config.play_videos);
  const tileRatio = input.config.tile_ratio === 'square' ? '1 / 1' : '4 / 5';
  const reveal = revealMode(input.config.reveal_animation);
  const stagger = reveal === 'cascade' || reveal === 'scale';
  const layout = input.config.layout === 'slider' ? 'slider' : 'grid';
  const customCss = input.config.custom_css
    ? escapeHtml(input.config.custom_css)
    : '';

  const cards = input.posts
    .map((post, index) => {
      const display = displayMediaForPost({
        media_type: post.media_type,
        media_url: post.media_url,
        thumbnail_url: post.thumbnail_url,
      });
      const href = escapeHtml(httpsUrl(post.permalink) ?? '#');
      const caption = post.caption ? escapeHtml(post.caption) : '';
      const src = escapeHtml(httpsUrl(display.src) ?? '');
      const isVideo = display.isVideo || post.media_type === 'VIDEO';
      const videoSrc =
        playVideos && isVideo ? escapeHtml(httpsUrl(post.video_url) ?? '') : '';
      const play = isVideo
        ? '<span class="ff-play" aria-hidden="true"></span>'
        : '';
      const video = videoSrc
        ? `<video class="ff-video" src="${videoSrc}" ${src ? `poster="${src}"` : ''} muted playsinline loop preload="none"></video>`
        : '';
      const stats: string[] = [];
      if (showLikes && typeof post.like_count === 'number') {
        stats.push(
          `<span class="ff-stat"><span aria-hidden="true">♥</span> ${formatCount(post.like_count)} <span class="ff-sr">likes</span></span>`,
        );
      }
      if (showLikes && typeof post.comment_count === 'number') {
        stats.push(
          `<span class="ff-stat"><span aria-hidden="true">💬</span> ${formatCount(post.comment_count)} <span class="ff-sr">comments</span></span>`,
        );
      }
      const statsHtml = stats.length
        ? `<span class="ff-stats">${stats.join('')}</span>`
        : '';
      const captionHtml =
        showCaptions && caption ? `<p class="ff-caption">${caption}</p>` : '';

      const delay = stagger ? ` style="--ff-i:${Math.min(index, 11)}"` : '';

      return `<a class="ff-card${videoSrc ? ' ff-has-video' : ''}" href="${href}"${delay} target="_blank" rel="noopener noreferrer">
  <span class="ff-media">${src ? `<img src="${src}" alt="" loading="lazy" />` : '<span class="ff-empty">Post</span>'}${video}${play}${statsHtml}</span>
  ${captionHtml}
</a>`;
    })
    .join('\n');

  const empty = !input.posts.length
    ? '<p class="ff-empty-state">No posts yet. This feed updates automatically.</p>'
    : '';

  const stage =
    layout === 'slider'
      ? `<div class="ff-slider">
  <button type="button" class="ff-nav ff-prev" aria-label="Previous posts">‹</button>
  <div class="ff-track-wrap"><div class="ff-track">${cards}</div></div>
  <button type="button" class="ff-nav ff-next" aria-label="Next posts">›</button>
</div>`
      : `<div class="ff-grid" data-feedflow-grid>${cards}</div>`;

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
    .ff-slider {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ff-track-wrap { overflow: hidden; flex: 1; min-width: 0; }
    .ff-track {
      display: flex;
      gap: ${gap}px;
      transition: transform 0.35s ease;
    }
    .ff-slider .ff-card { flex: 0 0 100%; }
    @media (min-width: 640px) {
      .ff-slider .ff-card { flex-basis: calc((100% - ${gap * 2}px) / 3); }
    }
    @media (min-width: 960px) {
      .ff-slider .ff-card { flex-basis: calc((100% - ${gap * 4}px) / 5); }
    }
    .ff-nav {
      flex: 0 0 auto;
      width: 36px;
      height: 36px;
      border-radius: 999px;
      border: 1px solid #ddd;
      background: #fff;
      color: #111;
      cursor: pointer;
      font-size: 22px;
      line-height: 1;
    }
    .ff-nav:disabled { opacity: 0.35; cursor: default; }
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
      aspect-ratio: ${tileRatio};
      background: #111;
      overflow: hidden;
    }
    .ff-media img,
    .ff-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .ff-video {
      position: absolute;
      inset: 0;
      opacity: 0;
      pointer-events: none;
    }
    .ff-card.is-playing .ff-video { opacity: 1; }
    .ff-card.is-playing .ff-play { opacity: 0; }
    .ff-stats {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      background: rgba(0, 0, 0, 0.45);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .ff-stat { display: inline-flex; align-items: center; gap: 6px; }
    .ff-sr {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
    @media (hover: hover) {
      .ff-card:hover .ff-stats,
      .ff-card:focus-visible .ff-stats { opacity: 1; }
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
    @keyframes ff-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes ff-rise {
      from { opacity: 0; transform: translateY(28px); }
      to { opacity: 1; transform: none; }
    }
    @keyframes ff-cascade {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: none; }
    }
    @keyframes ff-scale {
      from { opacity: 0; transform: scale(0.94); }
      to { opacity: 1; transform: none; }
    }
    .ff-reveal-fade .ff-grid,
    .ff-reveal-fade .ff-slider {
      animation: ff-fade 0.7s ease both;
    }
    .ff-reveal-rise .ff-grid,
    .ff-reveal-rise .ff-slider {
      animation: ff-rise 0.75s cubic-bezier(.2,.7,.2,1) both;
    }
    .ff-reveal-cascade .ff-card {
      animation: ff-cascade 0.55s cubic-bezier(.2,.7,.2,1) both;
      animation-delay: calc(var(--ff-i, 0) * 70ms);
    }
    .ff-reveal-scale .ff-card {
      animation: ff-scale 0.5s cubic-bezier(.2,.7,.2,1) both;
      animation-delay: calc(var(--ff-i, 0) * 45ms);
    }
    @media (prefers-reduced-motion: reduce) {
      .ff-reveal-fade .ff-grid,
      .ff-reveal-fade .ff-slider,
      .ff-reveal-rise .ff-grid,
      .ff-reveal-rise .ff-slider,
      .ff-reveal-cascade .ff-card,
      .ff-reveal-scale .ff-card { animation: none; }
    }
    ${customCss}
  </style>
</head>
<body class="${reveal === 'none' ? '' : `ff-reveal-${reveal}`}">
  ${stage}
  ${empty}
  <script>
    function reportHeight() {
      var height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      if (window.parent && window.parent !== window) {
        // '*' is intentional: the parent is an arbitrary customer site. Payload is height only.
        window.parent.postMessage({ source: 'feedflow-embed', widget: ${JSON.stringify(input.embedKey)}, height: height }, '*');
      }
    }
    document.querySelectorAll('.ff-has-video').forEach(function (card) {
      var video = card.querySelector('video');
      if (!video) return;
      function start() {
        card.classList.add('is-playing');
        var play = video.play();
        if (play && play.catch) play.catch(function () { card.classList.remove('is-playing'); });
      }
      function stop() {
        card.classList.remove('is-playing');
        video.pause();
        try { video.currentTime = 0; } catch (e) {}
      }
      card.addEventListener('mouseenter', start);
      card.addEventListener('mouseleave', stop);
      card.addEventListener('focus', start);
      card.addEventListener('blur', stop);
    });
    var slider = document.querySelector('.ff-slider');
    if (slider) {
      var track = slider.querySelector('.ff-track');
      var prev = slider.querySelector('.ff-prev');
      var next = slider.querySelector('.ff-next');
      var index = 0;
      function perView() {
        if (window.innerWidth >= 960) return 5;
        if (window.innerWidth >= 640) return 3;
        return 1;
      }
      function layoutSlider() {
        var count = track.children.length;
        var max = Math.max(0, count - perView());
        if (index > max) index = max;
        var card = track.children[0];
        if (!card) return;
        var step = card.getBoundingClientRect().width + ${gap};
        track.style.transform = 'translateX(' + (-index * step) + 'px)';
        prev.disabled = index <= 0;
        next.disabled = index >= max;
        reportHeight();
      }
      prev.addEventListener('click', function () { index -= 1; layoutSlider(); });
      next.addEventListener('click', function () { index += 1; layoutSlider(); });
      window.addEventListener('resize', layoutSlider);
      layoutSlider();
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
