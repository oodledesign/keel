export type PlayerPreload = 'none' | 'metadata' | 'auto';

export type LogoPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export type AspectRatio = '16:9' | '4:3' | '1:1' | '9:16';

export type VideoPlayerConfigValues = {
  name: string;
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  preload: PlayerPreload;
  default_playback_speed: number;
  allowed_speeds: number[];
  show_controls: boolean;
  show_play_button: boolean;
  show_progress_bar: boolean;
  show_volume_control: boolean;
  show_speed_control: boolean;
  show_fullscreen_button: boolean;
  show_captions_button: boolean;
  primary_color: string;
  show_bunny_watermark: boolean;
  custom_logo_url: string | null;
  logo_position: LogoPosition;
  enable_captions: boolean;
  default_caption_language: string;
  responsive: boolean;
  aspect_ratio: AspectRatio;
  max_width_px: number | null;
  allow_download: boolean;
  token_auth_enabled: boolean;
};

export type VideoPlayerConfigRow = VideoPlayerConfigValues & {
  id: string;
  account_id: string;
  video_id: string | null;
  is_preset: boolean;
  created_at: string;
  updated_at: string;
};

export const PLAYBACK_SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export const ASPECT_RATIO_OPTIONS: AspectRatio[] = [
  '16:9',
  '4:3',
  '1:1',
  '9:16',
];

export function detectAspectRatio(
  width: number | null | undefined,
  height: number | null | undefined,
): AspectRatio {
  if (!width || !height || width <= 0 || height <= 0) return '16:9';

  const sourceRatio = width / height;
  const ratios: Array<{ value: AspectRatio; ratio: number }> = [
    { value: '16:9', ratio: 16 / 9 },
    { value: '4:3', ratio: 4 / 3 },
    { value: '1:1', ratio: 1 },
    { value: '9:16', ratio: 9 / 16 },
  ];

  return ratios.reduce((closest, candidate) =>
    Math.abs(candidate.ratio - sourceRatio) <
    Math.abs(closest.ratio - sourceRatio)
      ? candidate
      : closest,
  ).value;
}

export const DEFAULT_PLAYER_CONFIG: VideoPlayerConfigValues = {
  name: 'Default',
  autoplay: false,
  muted: false,
  loop: false,
  preload: 'metadata',
  default_playback_speed: 1,
  allowed_speeds: [...PLAYBACK_SPEED_OPTIONS],
  show_controls: true,
  show_play_button: true,
  show_progress_bar: true,
  show_volume_control: true,
  show_speed_control: true,
  show_fullscreen_button: true,
  show_captions_button: true,
  primary_color: '#6366F1',
  show_bunny_watermark: false,
  custom_logo_url: null,
  logo_position: 'top-right',
  enable_captions: false,
  default_caption_language: 'en',
  responsive: true,
  aspect_ratio: '16:9',
  max_width_px: null,
  allow_download: false,
  token_auth_enabled: false,
};

export type CaptionTrack = {
  srclang: string;
  label: string;
};
