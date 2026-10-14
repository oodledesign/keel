import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { IgConnectedAccountRow, IgContactRow } from '../types';

/**
 * Find or create the contact for an Instagram-scoped user id. When `inbound`
 * is set, refreshes last_inbound_at, which opens the 24-hour window.
 */
export async function upsertIgContact(
  admin: SupabaseClient,
  params: {
    igAccount: Pick<IgConnectedAccountRow, 'id' | 'account_id'>;
    igsid: string;
    username?: string | null;
    inboundAt?: string | null;
  },
): Promise<IgContactRow> {
  const { data: existing, error: selectError } = await admin
    .from('ig_contacts')
    .select('*')
    .eq('ig_account_id', params.igAccount.id)
    .eq('igsid', params.igsid)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (params.username && params.username !== existing.username) {
      patch.username = params.username;
    }
    if (
      params.inboundAt &&
      (!existing.last_inbound_at ||
        Date.parse(params.inboundAt) > Date.parse(existing.last_inbound_at))
    ) {
      patch.last_inbound_at = params.inboundAt;
    }
    if (Object.keys(patch).length === 0) return existing as IgContactRow;

    const { data: updated, error } = await admin
      .from('ig_contacts')
      .update(patch)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return updated as IgContactRow;
  }

  const { data: inserted, error: insertError } = await admin
    .from('ig_contacts')
    .upsert(
      {
        account_id: params.igAccount.account_id,
        ig_account_id: params.igAccount.id,
        igsid: params.igsid,
        username: params.username ?? null,
        last_inbound_at: params.inboundAt ?? null,
      },
      { onConflict: 'ig_account_id,igsid' },
    )
    .select('*')
    .single();

  if (insertError) throw new Error(insertError.message);
  return inserted as IgContactRow;
}

export async function loadIgContact(
  admin: SupabaseClient,
  contactId: string,
): Promise<IgContactRow | null> {
  const { data, error } = await admin
    .from('ig_contacts')
    .select('*')
    .eq('id', contactId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as IgContactRow | null) ?? null;
}

export async function updateContactTags(
  admin: SupabaseClient,
  contact: IgContactRow,
  change: { add: string[]; remove: string[] },
): Promise<IgContactRow> {
  const normalise = (t: string) => t.trim().toLowerCase();
  const remove = new Set(change.remove.map(normalise));
  const tags = new Set(
    contact.tags.map(normalise).filter((t) => !remove.has(t)),
  );
  for (const tag of change.add) tags.add(normalise(tag));

  const next = [...tags].sort();
  const { data, error } = await admin
    .from('ig_contacts')
    .update({ tags: next })
    .eq('id', contact.id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as IgContactRow;
}
