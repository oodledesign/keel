'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';

import {
  DeleteOperatingCostSchema,
  UpsertModelRateSchema,
  UpsertOperatingCostSchema,
} from '../schema';

function firstOfMonth(dateYmd: string): string {
  const d = new Date(`${dateYmd}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid period month');
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

// New finance tables may precede generated Database types.
type UntypedTableClient = {
  from: (table: string) => {
    update: (payload: Record<string, unknown>) => {
      eq: (
        column: string,
        value: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
    insert: (
      payload: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
    delete: () => {
      eq: (
        column: string,
        value: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
    upsert: (
      payload: Record<string, unknown>,
      opts?: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

function untypedClient() {
  return getSupabaseServerClient() as unknown as UntypedTableClient;
}

export async function upsertOperatingCostAction(input: unknown) {
  const userId = await requireSuperAdmin();
  const parsed = UpsertOperatingCostSchema.parse(input);
  const client = untypedClient();

  const payload = {
    category: parsed.category,
    label: parsed.label,
    amount_minor: Math.round(parsed.amountMajor * 100),
    currency: parsed.currency.toLowerCase(),
    period_month: firstOfMonth(parsed.periodMonth),
    notes: parsed.notes?.trim() || null,
    created_by: userId,
  };

  if (parsed.id) {
    const { error } = await client
      .from('platform_operating_costs')
      .update(payload)
      .eq('id', parsed.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client
      .from('platform_operating_costs')
      .insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/admin/finances');
  return { ok: true as const };
}

export async function deleteOperatingCostAction(input: unknown) {
  await requireSuperAdmin();
  const parsed = DeleteOperatingCostSchema.parse(input);
  const client = untypedClient();

  const { error } = await client
    .from('platform_operating_costs')
    .delete()
    .eq('id', parsed.id);

  if (error) throw new Error(error.message);

  revalidatePath('/admin/finances');
  return { ok: true as const };
}

export async function upsertModelRateAction(input: unknown) {
  await requireSuperAdmin();
  const parsed = UpsertModelRateSchema.parse(input);
  const client = untypedClient();

  const { error } = await client.from('ai_model_cost_rates').upsert(
    {
      model: parsed.model.trim(),
      provider: parsed.provider,
      input_usd_per_mtok: parsed.inputUsdPerMtok,
      output_usd_per_mtok: parsed.outputUsdPerMtok,
      notes: parsed.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'model' },
  );

  if (error) throw new Error(error.message);

  revalidatePath('/admin/finances');
  return { ok: true as const };
}
