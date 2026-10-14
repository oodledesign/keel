import { z } from 'zod';

export const IG_MAX_ICE_BREAKERS = 4;
export const IG_MAX_MENU_ITEMS = 5;

export const igIceBreakerSchema = z.object({
  question: z.string().trim().min(1, 'Add a question').max(80),
  trigger_id: z.string().uuid('Choose an automation'),
});

export const igMenuItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('postback'),
    title: z.string().trim().min(1, 'Add a label').max(30),
    trigger_id: z.string().uuid('Choose an automation'),
  }),
  z.object({
    type: z.literal('web_url'),
    title: z.string().trim().min(1, 'Add a label').max(30),
    url: z.string().trim().url('Enter a full link, starting https://'),
  }),
]);

export const igMessengerProfileSchema = z.object({
  ice_breakers: z
    .array(igIceBreakerSchema)
    .max(IG_MAX_ICE_BREAKERS)
    .default([]),
  persistent_menu: z.array(igMenuItemSchema).max(IG_MAX_MENU_ITEMS).default([]),
  synced_at: z.string().nullable().optional(),
});

export type IgMessengerProfile = z.infer<typeof igMessengerProfileSchema>;
export type IgMenuItemConfig = z.infer<typeof igMenuItemSchema>;

export function parseIgMessengerProfile(value: unknown): IgMessengerProfile {
  const parsed = igMessengerProfileSchema.safeParse(value ?? {});
  return parsed.success
    ? parsed.data
    : { ice_breakers: [], persistent_menu: [], synced_at: null };
}
