import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  SavePlannerPlanSchema,
  savePlannerPlan,
} from '~/lib/planner/save-planner-plan';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = SavePlannerPlanSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid plan save request',
      },
      { status: 400 },
    );
  }

  const result = await savePlannerPlan(client, user.id, parsed.data);

  if (!result.success) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json(result);
}
