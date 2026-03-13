import { z } from 'zod/v3';

export const KitPrerequisitesInputSchema = z.object({});

export const KitPrerequisiteItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  required: z.boolean(),
  required_for: z.string().optional(),
  installed: z.boolean(),
  version: z.string().nullable(),
  minimum_version: z.string().nullable(),
  status: z.enum(['pass', 'warn', 'fail']),
  install_url: z.string().optional(),
  install_command: z.string().optional(),
  message: z.string().optional(),
  remedies: z.array(z.string()).default([]),
});

export const KitPrerequisitesOutputSchema = z.object({
  prerequisites: z.array(KitPrerequisiteItemSchema),
  overall: z.enum(['pass', 'warn', 'fail']),
  ready_to_develop: z.boolean(),
});

export type KitPrerequisitesInput = z.infer<typeof KitPrerequisitesInputSchema>;
export type KitPrerequisiteItem = z.infer<typeof KitPrerequisiteItemSchema>;
export type KitPrerequisitesOutput = z.infer<
  typeof KitPrerequisitesOutputSchema
>;
