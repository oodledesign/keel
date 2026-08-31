export type UnifiedPost = {
  id: string;
  media_url: string;
  thumbnail_url: string;
  caption: string;
  permalink: string;
  timestamp: string;
  media_type: string;
  like_count?: number;
  view_count?: number;
  username?: string | null;
};
