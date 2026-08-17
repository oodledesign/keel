import { z } from 'zod';

export const BrochureOrientationSchema = z.enum(['portrait', 'landscape']);
export const BrochureTemplateIdSchema = z.enum([
  'classic',
  'editorial',
  'compact',
]);

export const BrochureLayoutIdSchema = z.enum([
  'cover_hero_band',
  'facts_table',
  'description_highlights',
  'photo_full',
  'photo_grid_2',
  'photo_grid_3',
  'floorplan',
  'map_amenities',
  'contact',
]);

const HttpOrHttpsUrlOrNull = z.union([
  z
    .string()
    .url()
    .refine(
      (value) => value.startsWith('https://') || value.startsWith('http://'),
      { message: 'Image URLs must be http(s)' },
    )
    .refine(
      (value) => {
        try {
          const host = new URL(value).hostname.toLowerCase();
          return !(
            host === 'localhost' ||
            host === '127.0.0.1' ||
            host === '0.0.0.0' ||
            host === '::1' ||
            host.endsWith('.local') ||
            host.endsWith('.internal') ||
            host === '169.254.169.254' ||
            host.startsWith('169.254.') ||
            /^10\./.test(host) ||
            /^192\.168\./.test(host) ||
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
          );
        } catch {
          return false;
        }
      },
      { message: 'Image URL host is not allowed' },
    ),
  z.null(),
]);

const BrochureSlotValueSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('image'),
    mediaId: z.union([z.string().uuid(), z.null()]),
    url: HttpOrHttpsUrlOrNull,
  }),
  z.object({
    type: z.literal('text'),
    text: z.string().max(20000),
  }),
  z.object({
    type: z.literal('map'),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    amenities: z
      .array(
        z.object({
          label: z.string().max(200),
          index: z.number().int().min(1).max(99),
        }),
      )
      .max(20),
  }),
  z.object({
    type: z.literal('agents'),
  }),
  z.object({
    type: z.literal('facts'),
    rows: z
      .array(
        z.object({
          label: z.string().max(100),
          value: z.string().max(500),
        }),
      )
      .max(30),
  }),
]);

export const BrochurePageSchema = z.object({
  id: z.string().min(1).max(80),
  layoutId: BrochureLayoutIdSchema,
  sectionLabel: z.string().max(80).optional(),
  sectionNumber: z.string().max(10).optional(),
  slots: z.record(z.string().max(40), BrochureSlotValueSchema),
});

export const GetListingBrochureDocumentSchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
  orientation: BrochureOrientationSchema.default('portrait'),
});

export const SaveListingBrochureDocumentSchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
  templateId: BrochureTemplateIdSchema,
  orientation: BrochureOrientationSchema,
  pages: z.array(BrochurePageSchema).max(30),
});

export const RegenerateListingBrochureSchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
  templateId: BrochureTemplateIdSchema,
  orientation: BrochureOrientationSchema,
});

export const BrochurePdfQuerySchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
  orientation: BrochureOrientationSchema.default('portrait'),
  template: BrochureTemplateIdSchema.default('classic'),
  useSaved: z
    .enum(['0', '1'])
    .optional()
    .transform((v) => v === '1'),
});

export type GetListingBrochureDocumentInput = z.infer<
  typeof GetListingBrochureDocumentSchema
>;
export type SaveListingBrochureDocumentInput = z.infer<
  typeof SaveListingBrochureDocumentSchema
>;
export type RegenerateListingBrochureInput = z.infer<
  typeof RegenerateListingBrochureSchema
>;
