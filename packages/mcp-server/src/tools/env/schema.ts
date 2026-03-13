import { z } from 'zod/v3';

export const KitEnvModeSchema = z.enum(['development', 'production']);

export const KitEnvSchemaInputSchema = z.object({});

export const KitEnvReadInputSchema = z.object({
  mode: KitEnvModeSchema.default('development'),
});

export const KitEnvUpdateInputSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  mode: KitEnvModeSchema.optional(),
  file: z.string().optional(),
});

export const KitEnvRawReadInputSchema = z.object({
  file: z.string().min(1),
});

export const KitEnvRawWriteInputSchema = z.object({
  file: z.string().min(1),
  content: z.string(),
});

export const KitEnvSchemaOutputSchema = z.object({
  groups: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      variables: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          description: z.string(),
          required: z.boolean(),
          type: z.enum(['string', 'url', 'email', 'number', 'boolean', 'enum']),
          sensitive: z.boolean(),
          values: z.array(z.string()).optional(),
          hint: z.string().optional(),
          dependencies: z
            .array(
              z.object({
                variable: z.string(),
                condition: z.string(),
              }),
            )
            .optional(),
        }),
      ),
    }),
  ),
});

export const KitEnvReadOutputSchema = z.object({
  mode: KitEnvModeSchema,
  variables: z.record(
    z.object({
      key: z.string(),
      value: z.string(),
      source: z.string(),
      isOverridden: z.boolean(),
      overrideChain: z
        .array(
          z.object({
            source: z.string(),
            value: z.string(),
          }),
        )
        .optional(),
      validation: z.object({
        valid: z.boolean(),
        errors: z.array(z.string()),
      }),
      dependencies: z
        .array(
          z.object({
            variable: z.string(),
            condition: z.string(),
            satisfied: z.boolean(),
          }),
        )
        .optional(),
    }),
  ),
});

export const KitEnvUpdateOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const KitEnvRawReadOutputSchema = z.object({
  content: z.string(),
  exists: z.boolean(),
});

export const KitEnvRawWriteOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
