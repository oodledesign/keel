import { z } from 'zod/v3';

export const RunChecksInputSchema = z.object({
  state: z
    .object({
      scripts: z.array(z.string().min(1)).optional(),
      includeTests: z.boolean().optional(),
      failFast: z.boolean().optional(),
      maxOutputChars: z.number().int().min(200).max(20000).optional(),
    })
    .optional(),
});

export const RunChecksResultSchema = z.object({
  script: z.string(),
  command: z.string(),
  status: z.enum(['pass', 'fail', 'missing', 'skipped']),
  exit_code: z.number().int().nullable(),
  duration_ms: z.number().int().min(0),
  stdout: z.string(),
  stderr: z.string(),
  message: z.string().optional(),
});

export const RunChecksOutputSchema = z.object({
  overall: z.enum(['pass', 'fail']),
  scripts_requested: z.array(z.string()),
  checks: z.array(RunChecksResultSchema),
  summary: z.object({
    total: z.number().int().min(0),
    passed: z.number().int().min(0),
    failed: z.number().int().min(0),
    missing: z.number().int().min(0),
    skipped: z.number().int().min(0),
  }),
});

export type RunChecksInput = z.infer<typeof RunChecksInputSchema>;
export type RunChecksResult = z.infer<typeof RunChecksResultSchema>;
export type RunChecksOutput = z.infer<typeof RunChecksOutputSchema>;
