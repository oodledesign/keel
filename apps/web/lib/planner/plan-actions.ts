'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

const SavePlannerPlanSchema = z.object({
  scopeKey: z.string().regex(/^(personal|workspace:.+)$/),
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(['day', 'week']),
  markdown: z.string().trim().min(1).max(100_000),
});

type PlannerPlansTable = {
  upsert: (
    values: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => PromiseLike<{ error: { message: string } | null }>;
};

export async function savePlannerPlanAction(
  input: z.infer<typeof SavePlannerPlanSchema>,
) {
  try {
    const parsed = SavePlannerPlanSchema.parse(input);
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();

    const table = (
      client as unknown as { from: (name: string) => PlannerPlansTable }
    ).from('planner_plans');

    const { error } = await table.upsert(
      {
        user_id: user.id,
        scope_key: parsed.scopeKey,
        plan_date: parsed.planDate,
        mode: parsed.mode,
        markdown: parsed.markdown,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,scope_key,plan_date' },
    );

    if (error) return { success: false as const, error: error.message };

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

    return { success: true as const, error: null };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Could not save plan',
    };
  }
}
