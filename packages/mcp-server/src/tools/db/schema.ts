import { z } from 'zod/v3';

const DbToolSchema = z.enum(['supabase', 'drizzle-kit', 'prisma']);

const MigrationStatusSchema = z.object({
  applied: z.number(),
  pending: z.number(),
  pending_names: z.array(z.string()),
});

export const KitDbStatusInputSchema = z.object({});

export const KitDbStatusOutputSchema = z.object({
  connected: z.boolean(),
  tool: DbToolSchema,
  migrations: MigrationStatusSchema,
});

export const KitDbMigrateInputSchema = z.object({
  target: z.string().default('latest'),
});

export const KitDbMigrateOutputSchema = z.object({
  applied: z.array(z.string()),
  total_applied: z.number(),
  status: z.literal('success'),
});

export const KitDbSeedInputSchema = z.object({});

export const KitDbSeedOutputSchema = z.object({
  status: z.literal('success'),
  message: z.string(),
});

export const KitDbResetInputSchema = z.object({
  confirm: z.boolean().default(false),
});

export const KitDbResetOutputSchema = z.object({
  status: z.literal('success'),
  message: z.string(),
});

export type DbTool = z.infer<typeof DbToolSchema>;
export type KitDbStatusInput = z.infer<typeof KitDbStatusInputSchema>;
export type KitDbStatusOutput = z.infer<typeof KitDbStatusOutputSchema>;
export type KitDbMigrateInput = z.infer<typeof KitDbMigrateInputSchema>;
export type KitDbMigrateOutput = z.infer<typeof KitDbMigrateOutputSchema>;
export type KitDbSeedInput = z.infer<typeof KitDbSeedInputSchema>;
export type KitDbSeedOutput = z.infer<typeof KitDbSeedOutputSchema>;
export type KitDbResetInput = z.infer<typeof KitDbResetInputSchema>;
export type KitDbResetOutput = z.infer<typeof KitDbResetOutputSchema>;
