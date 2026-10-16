export type UnifiedPost = {
  id: string;
  media_url: string;
  thumbnail_url: string;
  caption: string;
  permalink: string;
  timestamp: string;
  media_type: string;
  like_count?: number | null;
  comment_count?: number | null;
  view_count?: number;
  video_url?: string | null;
  username?: string | null;
};
