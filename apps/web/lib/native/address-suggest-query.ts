import { z } from 'zod';

/**
 * Query parse for GET /api/native/v1/address-suggest.
 * Mapbox stays server-side — this only validates workspace + q + limit.
 */
export const NativeAddressSuggestQuerySchema = z.object({
  workspace: z.string().trim().min(1),
  q: z.string().trim().min(3).max(200),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

export type NativeAddressSuggestQuery = z.infer<
  typeof NativeAddressSuggestQuerySchema
>;

export function parseNativeAddressSuggestQuery(
  searchParams: URLSearchParams,
):
  | { ok: true; data: NativeAddressSuggestQuery }
  | { ok: false; reason: 'workspace' | 'query' } {
  const workspace = searchParams.get('workspace')?.trim() ?? '';
  if (!workspace) {
    return { ok: false, reason: 'workspace' };
  }

  const parsed = NativeAddressSuggestQuerySchema.safeParse({
    workspace,
    q: searchParams.get('q') ?? '',
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, reason: 'query' };
  }

  return { ok: true, data: parsed.data };
}
