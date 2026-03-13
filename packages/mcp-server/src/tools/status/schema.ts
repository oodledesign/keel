import { z } from 'zod/v3';

export const KitStatusInputSchema = z.object({});

export const KitStatusOutputSchema = z.object({
  variant: z.string(),
  variant_family: z.string(),
  framework: z.string(),
  database: z.string(),
  auth: z.string(),
  project_name: z.string(),
  node_version: z.string(),
  package_manager: z.string(),
  deps_installed: z.boolean(),
  git_clean: z.boolean(),
  git_branch: z.string(),
  git_modified_files: z.array(z.string()),
  git_untracked_files: z.array(z.string()),
  git_merge_check: z.object({
    target_branch: z.string().nullable(),
    detectable: z.boolean(),
    has_conflicts: z.boolean().nullable(),
    conflict_files: z.array(z.string()),
    message: z.string(),
  }),
  services: z.object({
    app: z.object({
      running: z.boolean(),
      port: z.number().nullable(),
    }),
    supabase: z.object({
      running: z.boolean(),
      api_port: z.number().nullable(),
      studio_port: z.number().nullable(),
    }),
  }),
  diagnostics: z.array(
    z.object({
      id: z.string(),
      status: z.enum(['pass', 'warn', 'fail']),
      message: z.string(),
      remedies: z.array(z.string()).default([]),
    }),
  ),
});

export type KitStatusInput = z.infer<typeof KitStatusInputSchema>;
export type KitStatusOutput = z.infer<typeof KitStatusOutputSchema>;
