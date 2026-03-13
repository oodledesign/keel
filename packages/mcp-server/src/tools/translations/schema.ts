import { z } from 'zod/v3';

export const KitTranslationsListInputSchema = z.object({});

const FlatTranslationsSchema = z.record(z.string(), z.string());
const NamespaceTranslationsSchema = z.record(
  z.string(),
  FlatTranslationsSchema,
);

const KitTranslationsListSuccessOutputSchema = z.object({
  base_locale: z.string(),
  locales: z.array(z.string()),
  namespaces: z.array(z.string()),
  translations: z.record(z.string(), NamespaceTranslationsSchema),
});

export const KitTranslationsListOutputSchema =
  KitTranslationsListSuccessOutputSchema;

export const KitTranslationsUpdateInputSchema = z.object({
  locale: z.string().min(1),
  namespace: z.string().min(1),
  key: z.string().min(1),
  value: z.string(),
});

const KitTranslationsUpdateSuccessOutputSchema = z.object({
  success: z.boolean(),
  file: z.string(),
});

export const KitTranslationsUpdateOutputSchema =
  KitTranslationsUpdateSuccessOutputSchema;

export const KitTranslationsStatsInputSchema = z.object({});

const KitTranslationsStatsSuccessOutputSchema = z.object({
  base_locale: z.string(),
  locale_count: z.number(),
  namespace_count: z.number(),
  total_keys: z.number(),
  coverage: z.record(
    z.string(),
    z.object({
      total: z.number(),
      translated: z.number(),
      missing: z.number(),
      percentage: z.number(),
    }),
  ),
});

export const KitTranslationsStatsOutputSchema =
  KitTranslationsStatsSuccessOutputSchema;

export type KitTranslationsListInput = z.infer<
  typeof KitTranslationsListInputSchema
>;
export type KitTranslationsListSuccess = z.infer<
  typeof KitTranslationsListSuccessOutputSchema
>;
export type KitTranslationsListOutput = z.infer<
  typeof KitTranslationsListOutputSchema
>;
export type KitTranslationsUpdateInput = z.infer<
  typeof KitTranslationsUpdateInputSchema
>;
export type KitTranslationsUpdateSuccess = z.infer<
  typeof KitTranslationsUpdateSuccessOutputSchema
>;
export type KitTranslationsUpdateOutput = z.infer<
  typeof KitTranslationsUpdateOutputSchema
>;
export type KitTranslationsStatsInput = z.infer<
  typeof KitTranslationsStatsInputSchema
>;
export type KitTranslationsStatsSuccess = z.infer<
  typeof KitTranslationsStatsSuccessOutputSchema
>;
export type KitTranslationsStatsOutput = z.infer<
  typeof KitTranslationsStatsOutputSchema
>;

// --- Add Namespace ---

export const KitTranslationsAddNamespaceInputSchema = z.object({
  namespace: z.string().min(1),
});

const KitTranslationsAddNamespaceSuccessOutputSchema = z.object({
  success: z.boolean(),
  namespace: z.string(),
  files_created: z.array(z.string()),
});

export const KitTranslationsAddNamespaceOutputSchema =
  KitTranslationsAddNamespaceSuccessOutputSchema;

export type KitTranslationsAddNamespaceInput = z.infer<
  typeof KitTranslationsAddNamespaceInputSchema
>;
export type KitTranslationsAddNamespaceSuccess = z.infer<
  typeof KitTranslationsAddNamespaceSuccessOutputSchema
>;
export type KitTranslationsAddNamespaceOutput = z.infer<
  typeof KitTranslationsAddNamespaceOutputSchema
>;

// --- Add Locale ---

export const KitTranslationsAddLocaleInputSchema = z.object({
  locale: z.string().min(1),
});

const KitTranslationsAddLocaleSuccessOutputSchema = z.object({
  success: z.boolean(),
  locale: z.string(),
  files_created: z.array(z.string()),
});

export const KitTranslationsAddLocaleOutputSchema =
  KitTranslationsAddLocaleSuccessOutputSchema;

export type KitTranslationsAddLocaleInput = z.infer<
  typeof KitTranslationsAddLocaleInputSchema
>;
export type KitTranslationsAddLocaleSuccess = z.infer<
  typeof KitTranslationsAddLocaleSuccessOutputSchema
>;
export type KitTranslationsAddLocaleOutput = z.infer<
  typeof KitTranslationsAddLocaleOutputSchema
>;

// --- Remove Namespace ---

export const KitTranslationsRemoveNamespaceInputSchema = z.object({
  namespace: z.string().min(1),
});

const KitTranslationsRemoveNamespaceSuccessOutputSchema = z.object({
  success: z.boolean(),
  namespace: z.string(),
  files_removed: z.array(z.string()),
});

export const KitTranslationsRemoveNamespaceOutputSchema =
  KitTranslationsRemoveNamespaceSuccessOutputSchema;

export type KitTranslationsRemoveNamespaceInput = z.infer<
  typeof KitTranslationsRemoveNamespaceInputSchema
>;
export type KitTranslationsRemoveNamespaceSuccess = z.infer<
  typeof KitTranslationsRemoveNamespaceSuccessOutputSchema
>;
export type KitTranslationsRemoveNamespaceOutput = z.infer<
  typeof KitTranslationsRemoveNamespaceOutputSchema
>;

// --- Remove Locale ---

export const KitTranslationsRemoveLocaleInputSchema = z.object({
  locale: z.string().min(1),
});

const KitTranslationsRemoveLocaleSuccessOutputSchema = z.object({
  success: z.boolean(),
  locale: z.string(),
  path_removed: z.string(),
});

export const KitTranslationsRemoveLocaleOutputSchema =
  KitTranslationsRemoveLocaleSuccessOutputSchema;

export type KitTranslationsRemoveLocaleInput = z.infer<
  typeof KitTranslationsRemoveLocaleInputSchema
>;
export type KitTranslationsRemoveLocaleSuccess = z.infer<
  typeof KitTranslationsRemoveLocaleSuccessOutputSchema
>;
export type KitTranslationsRemoveLocaleOutput = z.infer<
  typeof KitTranslationsRemoveLocaleOutputSchema
>;
