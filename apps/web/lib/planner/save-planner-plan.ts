import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';

import { syncPlannerRemindersForPlan } from './reminder-sync';

export const SavePlannerPlanSchema = z.object({
  scopeKey: z.string().regex(/^(personal|workspace:.+)$/),
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(['day', 'week']),
  markdown: z.string().trim().min(1).max(100_000),
});

export type SavePlannerPlanInput = z.infer<typeof SavePlannerPlanSchema>;

export type SavePlannerPlanResult =
  | { success: true; error: null }
  | { success: false; error: string };

type PlannerPlansTable = {
  upsert: (
    values: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => PromiseLike<{ error: { message: string } | null }>;
};

export async function savePlannerPlan(
  client: SupabaseClient,
  userId: string,
  input: SavePlannerPlanInput,
): Promise<SavePlannerPlanResult> {
  const parsed = SavePlannerPlanSchema.parse(input);

  const table = (
    client as unknown as { from: (name: string) => PlannerPlansTable }
  ).from('planner_plans');

  const { error } = await table.upsert(
    {
      user_id: userId,
      scope_key: parsed.scopeKey,
      plan_date: parsed.planDate,
      mode: parsed.mode,
      markdown: parsed.markdown,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,scope_key,plan_date' },
  );

  if (error) {
    return { success: false, error: error.message };
  }

  try {
    await syncPlannerRemindersForPlan(
      client,
      userId,
      parsed.scopeKey,
      parsed.planDate,
      parsed.markdown,
      parsed.mode,
    );
  } catch {
    // Plan saved; reminder queue sync is best-effort.
  }

  if (parsed.scopeKey === 'personal') {
    revalidatePath(pathsConfig.app.personalPlannerDay);
    revalidatePath(pathsConfig.app.personalPlanner);
  } else {
    const slug = parsed.scopeKey.slice('workspace:'.length);
    revalidatePath(
      pathsConfig.app.accountPlannerDay.replace('[account]', slug),
    );
    revalidatePath(pathsConfig.app.accountPlanner.replace('[account]', slug));
  }

  return { success: true, error: null };
}
