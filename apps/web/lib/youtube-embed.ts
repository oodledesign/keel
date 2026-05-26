/** Extract YouTube video id from common URL shapes. */
export function youtubeVideoId(url: string): string | null {
  const raw = url?.trim();
  if (!raw) return null;

  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && id.length >= 6 ? id : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = u.searchParams.get('v');
      if (v) return v;
      const embed = u.pathname.match(/^\/embed\/([^/?]+)/);
      if (embed?.[1]) return embed[1];
      const shorts = u.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shorts?.[1]) return shorts[1];
    }
  } catch {
    return null;
  }

  return null;
}

export function youtubeEmbedUrl(url: string): string | null {
  const id = youtubeVideoId(url);
  if (!id) return null;
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
