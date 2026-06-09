import { z } from 'zod';

export const videoSettingsSchema = z.object({
  default_player_preset_id: z.string().uuid().nullable().optional(),
  bunny_library_id: z.string().min(1).max(120).nullable().optional(),
  bunny_api_key_encrypted: z.string().min(1).nullable().optional(),
});

export type VideoSettings = z.infer<typeof videoSettingsSchema>;

export type VideoSettingsPublic = {
  default_player_preset_id: string | null;
  bunny_library_id: string | null;
  has_bunny_api_key: boolean;
};

export function parseVideoSettings(raw: unknown): VideoSettings {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const parsed = videoSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export function toPublicVideoSettings(
  settings: VideoSettings,
): VideoSettingsPublic {
  return {
    default_player_preset_id: settings.default_player_preset_id ?? null,
    bunny_library_id: settings.bunny_library_id ?? null,
    has_bunny_api_key: Boolean(settings.bunny_api_key_encrypted),
  };
}
