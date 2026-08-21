'use server';

import 'server-only';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import {
  PLACEHOLDER_COMPLIANCE_LABELS,
  type InstructionCareLogEntry,
  type InstructionComplianceItem,
} from './instruction-care-compliance.shared';

const InstructionIdSchema = z.object({
  instructionId: z.string().uuid(),
  accountSlug: z.string().min(1).optional(),
});

function revalidateWip(accountSlug?: string) {
  if (accountSlug) {
    revalidatePath(
      pathsConfig.app.accountPipeline.replace('[account]', accountSlug),
    );
  }
}

export const listInstructionCareLog = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    // Tables may lag generated Database types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = client as any;
    const { data, error } = await db
      .from('instruction_client_care_log')
      .select('id, note, created_at, created_by')
      .eq('instruction_id', input.instructionId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const entries: InstructionCareLogEntry[] = (
      (data ?? []) as Array<{
        id: string;
        note: string;
        created_at: string;
        created_by: string;
      }>
    ).map((row) => ({
      id: row.id,
      note: row.note,
      createdAt: row.created_at,
      createdBy: row.created_by,
    }));

    return { entries };
  },
  { schema: InstructionIdSchema },
);

export const addInstructionCareLogEntry = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = client as any;
    const { data, error } = await db
      .from('instruction_client_care_log')
      .insert({
        instruction_id: input.instructionId,
        note: input.note.trim(),
        created_by: user.id,
      })
      .select('id, note, created_at, created_by')
      .single();

    if (error) throw new Error(error.message);

    revalidateWip(input.accountSlug);

    return {
      entry: {
        id: data.id as string,
        note: data.note as string,
        createdAt: data.created_at as string,
        createdBy: data.created_by as string,
      } satisfies InstructionCareLogEntry,
    };
  },
  {
    schema: InstructionIdSchema.extend({
      note: z.string().trim().min(1, 'Note cannot be empty').max(4000),
    }),
  },
);

export const ensureInstructionComplianceItems = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = client as any;

    const { data: existing, error: existingError } = await db
      .from('instruction_compliance_items')
      .select('id, label, is_checked, checked_at, sort_order')
      .eq('instruction_id', input.instructionId)
      .order('sort_order', { ascending: true });

    if (existingError) throw new Error(existingError.message);

    if ((existing ?? []).length > 0) {
      return {
        items: (
          existing as Array<{
            id: string;
            label: string;
            is_checked: boolean;
            checked_at: string | null;
            sort_order: number;
          }>
        ).map(
          (row): InstructionComplianceItem => ({
            id: row.id,
            label: row.label,
            isChecked: row.is_checked,
            checkedAt: row.checked_at,
            sortOrder: row.sort_order,
          }),
        ),
      };
    }

    const rows = PLACEHOLDER_COMPLIANCE_LABELS.map((label, index) => ({
      instruction_id: input.instructionId,
      label,
      sort_order: index,
    }));

    const { data: inserted, error: insertError } = await db
      .from('instruction_compliance_items')
      .upsert(rows, {
        onConflict: 'instruction_id,label',
        ignoreDuplicates: true,
      })
      .select('id, label, is_checked, checked_at, sort_order')
      .eq('instruction_id', input.instructionId)
      .order('sort_order', { ascending: true });

    if (insertError) throw new Error(insertError.message);

    // Re-read after upsert so concurrent seeders still return a full set.
    if (!inserted?.length) {
      const { data: after, error: afterError } = await db
        .from('instruction_compliance_items')
        .select('id, label, is_checked, checked_at, sort_order')
        .eq('instruction_id', input.instructionId)
        .order('sort_order', { ascending: true });
      if (afterError) throw new Error(afterError.message);
      return {
        items: (
          (after ?? []) as Array<{
            id: string;
            label: string;
            is_checked: boolean;
            checked_at: string | null;
            sort_order: number;
          }>
        ).map(
          (row): InstructionComplianceItem => ({
            id: row.id,
            label: row.label,
            isChecked: row.is_checked,
            checkedAt: row.checked_at,
            sortOrder: row.sort_order,
          }),
        ),
      };
    }

    return {
      items: (
        (inserted ?? []) as Array<{
          id: string;
          label: string;
          is_checked: boolean;
          checked_at: string | null;
          sort_order: number;
        }>
      ).map(
        (row): InstructionComplianceItem => ({
          id: row.id,
          label: row.label,
          isChecked: row.is_checked,
          checkedAt: row.checked_at,
          sortOrder: row.sort_order,
        }),
      ),
    };
  },
  { schema: InstructionIdSchema },
);

export const setInstructionComplianceChecked = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = client as any;
    const { data, error } = await db
      .from('instruction_compliance_items')
      .update({
        is_checked: input.isChecked,
        checked_at: input.isChecked ? new Date().toISOString() : null,
        checked_by: input.isChecked ? user.id : null,
      })
      .eq('id', input.itemId)
      .eq('instruction_id', input.instructionId)
      .select('id, label, is_checked, checked_at, sort_order')
      .single();

    if (error) throw new Error(error.message);

    revalidateWip(input.accountSlug);

    return {
      item: {
        id: data.id as string,
        label: data.label as string,
        isChecked: Boolean(data.is_checked),
        checkedAt: (data.checked_at as string | null) ?? null,
        sortOrder: data.sort_order as number,
      } satisfies InstructionComplianceItem,
    };
  },
  {
    schema: InstructionIdSchema.extend({
      itemId: z.string().uuid(),
      isChecked: z.boolean(),
    }),
  },
);

/** Latest care-log timestamp per instruction for board/ladder glance signals. */
export async function loadLatestCareLogByInstruction(
  instructionIds: string[],
): Promise<Record<string, string>> {
  if (instructionIds.length === 0) return {};

  const client = getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const { data, error } = await db
    .from('instruction_client_care_log')
    .select('instruction_id, created_at')
    .in('instruction_id', instructionIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[wip] loadLatestCareLogByInstruction', error.message);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of (data ?? []) as Array<{
    instruction_id: string;
    created_at: string;
  }>) {
    if (!map[row.instruction_id]) {
      map[row.instruction_id] = row.created_at;
    }
  }
  return map;
}
