import { type GoogleDocKind, parseGoogleDoc } from './canvas-google';

/** How a link card is shown, as in Notion: a preview card, a text link, or a big embed. */
export const LINK_DISPLAYS = ['card', 'link', 'embed'] as const;
export type LinkDisplay = (typeof LINK_DISPLAYS)[number];

export type EmbedProvider = 'google' | 'youtube' | 'vimeo' | 'loom' | 'figma';

export type EmbedSource = {
  provider: EmbedProvider;
  /** "Google Sheet", "YouTube video"… */
  label: string;
  googleKind?: GoogleDocKind;
  /** What the embedded card shows by default. */
  previewUrl: string;
  /** A separate full editor (Google files), when there is one. */
  editUrl: string | null;
  /** The normal link, for "open in …". */
  openUrl: string;
  /** Width ÷ height of the content, when it has a fixed shape (video). */
  aspect: number | null;
};

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const VIDEO_ID = /^[\w-]{11}$/;

/** `90`, `90s` or `1m30s` → seconds. */
function parseStart(raw: string | null): number | null {
  if (!raw) return null;
  if (/^\d+s?$/.test(raw)) return Number.parseInt(raw, 10);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw);
  if (!match || !match[0]) return null;
  return (
    Number(match[1] ?? 0) * 3600 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0)
  );
}

function youtube(url: URL): EmbedSource | null {
  let id: string | null = null;
  if (url.hostname === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0] ?? null;
  } else if (YOUTUBE_HOSTS.has(url.hostname)) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else if (['shorts', 'embed', 'live', 'v'].includes(parts[0] ?? ''))
      id = parts[1] ?? null;
  }
  if (!id || !VIDEO_ID.test(id)) return null;
  const start = parseStart(
    url.searchParams.get('t') ?? url.searchParams.get('start'),
  );
  return {
    provider: 'youtube',
    label: 'YouTube video',
    previewUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0${start ? `&start=${start}` : ''}`,
    editUrl: null,
    openUrl: `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}`,
    aspect: 16 / 9,
  };
}

function vimeo(url: URL): EmbedSource | null {
  if (url.hostname !== 'vimeo.com' && url.hostname !== 'www.vimeo.com') {
    return null;
  }
  const match = /^\/(\d{6,})(?:\/([\da-f]{6,}))?\/?$/.exec(url.pathname);
  if (!match) return null;
  const hash = match[2] ?? url.searchParams.get('h');
  return {
    provider: 'vimeo',
    label: 'Vimeo video',
    previewUrl: `https://player.vimeo.com/video/${match[1]}${hash && /^[\da-f]+$/.test(hash) ? `?h=${hash}` : ''}`,
    editUrl: null,
    openUrl: url.toString(),
    aspect: 16 / 9,
  };
}

function loom(url: URL): EmbedSource | null {
  if (url.hostname !== 'loom.com' && url.hostname !== 'www.loom.com') {
    return null;
  }
  const match = /^\/(?:share|embed)\/([\da-f]{32})\/?$/.exec(url.pathname);
  if (!match) return null;
  return {
    provider: 'loom',
    label: 'Loom video',
    previewUrl: `https://www.loom.com/embed/${match[1]}`,
    editUrl: null,
    openUrl: `https://www.loom.com/share/${match[1]}`,
    aspect: 16 / 9,
  };
}

function figma(url: URL): EmbedSource | null {
  if (url.hostname !== 'figma.com' && url.hostname !== 'www.figma.com') {
    return null;
  }
  if (!/^\/(file|design|proto|board|slides)\//.test(url.pathname)) return null;
  return {
    provider: 'figma',
    label: 'Figma file',
    previewUrl: `https://www.figma.com/embed?embed_host=keel&url=${encodeURIComponent(url.toString())}`,
    editUrl: null,
    openUrl: url.toString(),
    aspect: null,
  };
}

/** The embeddable form of a link, or null when the site can't be embedded. */
export function resolveEmbed(
  raw: string | undefined | null,
): EmbedSource | null {
  if (!raw) return null;

  const google = parseGoogleDoc(raw);
  if (google) {
    return {
      provider: 'google',
      label: google.label,
      googleKind: google.kind,
      previewUrl: google.previewUrl,
      editUrl: google.editUrl,
      openUrl: google.openUrl,
      aspect: null,
    };
  }

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  return youtube(url) ?? vimeo(url) ?? loom(url) ?? figma(url);
}

const CARD_SIZE = { w: 320, h: 150 };
const LINK_SIZE = { w: 320, h: 40 };
const EMBED_WIDTH = 560;
const EMBED_HEADER = 36;

/** The size a link card takes when switched to a display. */
export function linkDisplaySize(
  display: LinkDisplay,
  embed: EmbedSource | null,
): { w: number; h: number } {
  if (display === 'link') return { ...LINK_SIZE };
  if (display === 'card') return { ...CARD_SIZE };
  return {
    w: EMBED_WIDTH,
    h: embed?.aspect
      ? Math.round(EMBED_WIDTH / embed.aspect) + EMBED_HEADER
      : 420,
  };
}

/** Embeds only apply where the site allows them; everything else is a card or a link. */
export function effectiveLinkDisplay(
  display: LinkDisplay | undefined,
  embed: EmbedSource | null,
): LinkDisplay {
  if (display === 'embed' && !embed) return 'card';
  return display ?? 'card';
}
