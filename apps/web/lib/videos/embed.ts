import type { VideoPlayerConfigValues, PlayerPreload } from './player-config-types';

const EMBED_BASE = 'https://iframe.mediadelivery.net/embed';

/** Bunny embed only accepts preload=true|false, not HTML5 metadata/auto strings. */
export function mapPreloadForBunnyEmbed(preload: PlayerPreload): boolean {
  return preload === 'auto';
}

export function aspectRatioPadding(ratio: string): string {
  switch (ratio) {
    case '4:3':
      return '75%';
    case '1:1':
      return '100%';
    case '9:16':
      return '177.78%';
    case '16:9':
    default:
      return '56.25%';
  }
}

export function aspectRatioCss(ratio: string): string {
  switch (ratio) {
    case '4:3':
      return '4/3';
    case '1:1':
      return '1/1';
    case '9:16':
      return '9/16';
    default:
      return '16/9';
  }
}

export function buildEmbedUrl(
  libraryId: string,
  bunnyVideoId: string,
  config: VideoPlayerConfigValues,
): string {
  const url = new URL(`${EMBED_BASE}/${libraryId}/${bunnyVideoId}`);

  url.searchParams.set('autoplay', config.autoplay ? 'true' : 'false');
  url.searchParams.set('loop', config.loop ? 'true' : 'false');
  url.searchParams.set('muted', config.muted ? 'true' : 'false');
  url.searchParams.set('preload', mapPreloadForBunnyEmbed(config.preload) ? 'true' : 'false');
  url.searchParams.set('responsive', config.responsive ? 'true' : 'false');
  url.searchParams.set('controls', config.show_controls ? 'true' : 'false');
  url.searchParams.set('playButton', config.show_play_button ? 'true' : 'false');
  url.searchParams.set('captions', config.enable_captions ? 'true' : 'false');

  if (config.enable_captions && config.default_caption_language) {
    url.searchParams.set('defaultLanguage', config.default_caption_language);
  }

  return url.toString();
}

export function buildIframeEmbedCode(
  libraryId: string,
  bunnyVideoId: string,
  config: VideoPlayerConfigValues,
): string {
  const src = buildEmbedUrl(libraryId, bunnyVideoId, config);
  const ratio = aspectRatioCss(config.aspect_ratio);
  const maxWidth = config.max_width_px
    ? `max-width:${config.max_width_px}px;`
    : '';

  return `<iframe
  src="${src}"
  loading="lazy"
  style="border:none;width:100%;aspect-ratio:${ratio};${maxWidth}"
  allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture"
  allowfullscreen
></iframe>`;
}

export function buildHtml5VideoCode(
  cdnHostname: string,
  bunnyVideoId: string,
  config: VideoPlayerConfigValues,
): string {
  const host = cdnHostname.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const attrs = [
    config.show_controls ? 'controls' : '',
    config.autoplay ? 'autoplay' : '',
    config.muted ? 'muted' : '',
    config.loop ? 'loop' : '',
    `preload="${config.preload}"`,
  ]
    .filter(Boolean)
    .join(' ');

  return `<video ${attrs} style="width:100%;aspect-ratio:${aspectRatioCss(config.aspect_ratio)}">
  <source src="https://${host}/${bunnyVideoId}/play_720p.mp4" type="video/mp4">
</video>`;
}

export function buildJavaScriptEmbedCode(
  libraryId: string,
  bunnyVideoId: string,
  config: VideoPlayerConfigValues,
): string {
  const src = buildEmbedUrl(libraryId, bunnyVideoId, config);

  return `const player = document.createElement('iframe');
player.src = '${src}';
player.loading = 'lazy';
player.allow = 'accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture';
player.allowFullscreen = true;
player.style.border = 'none';
player.style.width = '100%';
player.style.aspectRatio = '${aspectRatioCss(config.aspect_ratio)}';
// config: ${JSON.stringify(config, null, 2)}
document.getElementById('video-container').appendChild(player);`;
}

export function buildWebflowInstructions(
  libraryId: string,
  bunnyVideoId: string,
  config: VideoPlayerConfigValues,
): string {
  const iframe = buildIframeEmbedCode(libraryId, bunnyVideoId, config);
  const padding = aspectRatioPadding(config.aspect_ratio);

  return `Webflow embed instructions

1. In Webflow, add an Embed element to your page.
2. Paste the iframe code below into the embed block.
3. For a responsive video, wrap the iframe in a div with:
   padding-bottom: ${padding};
   position: relative;
   height: 0;
   overflow: hidden;
4. Set the iframe to:
   position: absolute;
   top: 0;
   left: 0;
   width: 100%;
   height: 100%;

Iframe code:
${iframe}`;
}
