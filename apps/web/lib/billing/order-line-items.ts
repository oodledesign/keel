import type { Json } from '@kit/supabase/database';

/** Order line items arrive as JSON (`upsert_order.line_items`). */
export function parseOrderLineItems(
  lineItems: Json,
): Array<{ variantId: string | null; quantity: Json | undefined }> {
  if (!Array.isArray(lineItems)) return [];

  return lineItems.flatMap((item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? [
          {
            variantId:
              typeof item.variant_id === 'string' ? item.variant_id : null,
            quantity: item.quantity,
          },
        ]
      : [],
  );
}
