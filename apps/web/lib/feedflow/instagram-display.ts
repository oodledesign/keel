export type IgMediaChild = {
  id: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
};

export type IgMediaItem = {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  username?: string;
  children?: { data?: IgMediaChild[] };
};

export function flattenMediaChildren(item: IgMediaItem): IgMediaChild[] {
  return item.children?.data ?? [];
}

export function displayMediaForPost(item: {
  media_type: string;
  media_url?: string | null;
  thumbnail_url?: string | null;
  children?: IgMediaChild[] | { data?: IgMediaChild[] } | null;
}): { src: string; isVideo: boolean } {
  const children = Array.isArray(item.children)
    ? item.children
    : (item.children?.data ?? []);

  if (item.media_type === 'VIDEO') {
    return {
      src: item.thumbnail_url || item.media_url || '',
      isVideo: true,
    };
  }

  if (item.media_type === 'CAROUSEL_ALBUM') {
    const first = children[0];
    const src =
      first?.media_url ||
      first?.thumbnail_url ||
      item.media_url ||
      item.thumbnail_url ||
      '';
    return {
      src,
      isVideo: first?.media_type === 'VIDEO',
    };
  }

  return {
    src: item.media_url || item.thumbnail_url || '',
    isVideo: false,
  };
}
