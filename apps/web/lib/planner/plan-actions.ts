'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  type SavePlannerPlanInput,
  savePlannerPlan,
} from './save-planner-plan';

export async function savePlannerPlanAction(input: SavePlannerPlanInput) {
  try {
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();
    return await savePlannerPlan(client, user.id, input);
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Could not save plan',
    };
  }
}
