import { z } from 'zod/v3';

const DevServiceIdSchema = z.enum(['app', 'database', 'stripe', 'mailbox']);
const DevServiceSelectionSchema = z.enum([
  'all',
  'app',
  'database',
  'stripe',
  'mailbox',
  'mailpit',
]);

const DevServiceStatusItemSchema = z.object({
  id: DevServiceIdSchema,
  name: z.string(),
  status: z.enum(['running', 'stopped', 'error']),
  port: z.number().nullable().optional(),
  url: z.string().optional(),
  pid: z.number().nullable().optional(),
  webhook_url: z.string().optional(),
  extras: z.record(z.string()).optional(),
});

export const KitDevStartInputSchema = z.object({
  services: z.array(DevServiceSelectionSchema).min(1).default(['all']),
});

export const KitDevStartOutputSchema = z.object({
  services: z.array(DevServiceStatusItemSchema),
});

export const KitDevStopInputSchema = z.object({
  services: z.array(DevServiceSelectionSchema).min(1).default(['all']),
});

export const KitDevStopOutputSchema = z.object({
  stopped: z.array(DevServiceIdSchema),
});

export const KitDevStatusInputSchema = z.object({});

export const KitDevStatusOutputSchema = z.object({
  services: z.array(DevServiceStatusItemSchema),
});

export const KitMailboxStatusInputSchema = z.object({});

export const KitMailboxStatusOutputSchema = z.object({
  connected: z.boolean(),
  running: z.boolean(),
  api_reachable: z.boolean(),
  url: z.string().optional(),
  port: z.number().optional(),
  reason: z.string().optional(),
});

export type DevServiceId = z.infer<typeof DevServiceIdSchema>;
export type DevServiceSelection = z.infer<typeof DevServiceSelectionSchema>;
export type DevServiceStatusItem = z.infer<typeof DevServiceStatusItemSchema>;
export type KitDevStartInput = z.infer<typeof KitDevStartInputSchema>;
export type KitDevStartOutput = z.infer<typeof KitDevStartOutputSchema>;
export type KitDevStopInput = z.infer<typeof KitDevStopInputSchema>;
export type KitDevStopOutput = z.infer<typeof KitDevStopOutputSchema>;
export type KitDevStatusInput = z.infer<typeof KitDevStatusInputSchema>;
export type KitDevStatusOutput = z.infer<typeof KitDevStatusOutputSchema>;
export type KitMailboxStatusInput = z.infer<typeof KitMailboxStatusInputSchema>;
export type KitMailboxStatusOutput = z.infer<
  typeof KitMailboxStatusOutputSchema
>;
