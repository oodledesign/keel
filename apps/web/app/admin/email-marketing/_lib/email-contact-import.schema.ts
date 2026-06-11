import { z } from 'zod';

export const EMAIL_CONTACT_IMPORT_FIELD_KEYS = [
  'first_name',
  'last_name',
  'email',
  'trade',
  'notes',
  'subscribed',
] as const;

export type EmailContactImportFieldKey =
  (typeof EMAIL_CONTACT_IMPORT_FIELD_KEYS)[number];

export const EMAIL_CONTACT_IMPORT_MAPPING_VALUES = [
  '__skip__',
  ...EMAIL_CONTACT_IMPORT_FIELD_KEYS,
] as const;

export type EmailContactImportMappingValue =
  (typeof EMAIL_CONTACT_IMPORT_MAPPING_VALUES)[number];

export const EmailContactImportMappingValueSchema = z.enum(
  EMAIL_CONTACT_IMPORT_MAPPING_VALUES,
);

export const SuggestEmailContactImportMappingsSchema = z.object({
  headers: z.array(z.string()),
  sampleRows: z.array(z.record(z.string(), z.string())),
});

export const ImportEmailContactsFromCsvSchema = z.object({
  mapping: z.record(z.string(), EmailContactImportMappingValueSchema),
  rows: z.array(z.record(z.string(), z.string())),
  source: z.enum(['imported', 'beta']).optional(),
  customListId: z.string().uuid().optional(),
});
