export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'failed';

export type VideoRow = {
  id: string;
  account_id: string;
  folder_id: string | null;
  title: string;
  description: string | null;
  bunny_video_id: string;
  bunny_library_id: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  status: VideoStatus;
  original_filename: string | null;
  tags: string[];
  public_share_enabled: boolean;
  public_share_token: string | null;
  source?: 'upload' | 'screen_recording';
  recorded_at?: string | null;
  created_at: string;
  updated_at: string;
  /** Populated server-side for library UI; not stored in the database. */
  thumbnail_candidates?: string[];
};

export type VideoFolderRow = {
  id: string;
  account_id: string;
  name: string;
  parent_folder_id: string | null;
  created_at: string;
};

export type VideoSort = 'newest' | 'oldest' | 'name' | 'duration';

export type VideoViewMode = 'grid' | 'list';
