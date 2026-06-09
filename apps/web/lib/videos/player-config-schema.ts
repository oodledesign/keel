import { z } from 'zod';

export const playerConfigBodySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    autoplay: z.boolean(),
    muted: z.boolean(),
    loop: z.boolean(),
    preload: z.enum(['none', 'metadata', 'auto']),
    default_playback_speed: z.number().min(0.25).max(4),
    allowed_speeds: z.array(z.number()).optional(),
    show_controls: z.boolean(),
    show_play_button: z.boolean(),
    show_progress_bar: z.boolean(),
    show_volume_control: z.boolean(),
    show_speed_control: z.boolean(),
    show_fullscreen_button: z.boolean(),
    show_captions_button: z.boolean(),
    primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    show_bunny_watermark: z.boolean(),
    custom_logo_url: z
      .union([z.string().url(), z.literal(''), z.null()])
      .optional(),
    logo_position: z.enum([
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ]),
    enable_captions: z.boolean(),
    default_caption_language: z.string().min(2).max(12),
    responsive: z.boolean(),
    aspect_ratio: z.enum(['16:9', '4:3', '1:1', '9:16']),
    max_width_px: z.number().int().positive().nullable().optional(),
    allow_download: z.boolean(),
    token_auth_enabled: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.autoplay && !value.muted) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Autoplay requires muted to be enabled',
        path: ['muted'],
      });
    }
  });

export const savePresetBodySchema = z.object({
  action: z.literal('save-preset'),
  name: z.string().min(1).max(120),
  config: playerConfigBodySchema,
});
