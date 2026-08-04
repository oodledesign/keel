import { type NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  insufficientCreditsResponse,
  isInsufficientCreditsError,
} from '~/lib/ai/router';
import { streamPlannerMarkdown } from '~/lib/ai/planner-generate';

export const dynamic = 'force-dynamic';

const plannerTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  project: z.string(),
  workspace: z.string(),
  priority: z.string(),
  status: z.string(),
  estimated_duration_minutes: z.number().int().positive().nullable(),
  due_date: z.string().nullable(),
  notes: z.string().nullable(),
});

const generateSchema = z.object({
  accountId: z.string().uuid(),
  planning_mode: z.enum(['day', 'week']),
  date: z.string().min(1),
  working_hours: z.object({
    start: z.string().min(1),
    end: z.string().min(1),
  }),
  deep_work_preference: z.enum(['morning', 'afternoon', 'none']),
  user_context: z.string(),
  calendar_events: z.array(
    z.object({
      title: z.string(),
      start: z.string(),
      end: z.string(),
      calendar: z.string(),
      is_all_day: z.boolean(),
    }),
  ),
  tasks: z.array(plannerTaskSchema),
  /** Mid-day re-plan: reschedule the remainder of the day from current_time. */
  replan: z
    .object({
      current_time: z.string().min(1),
      existing_plan_markdown: z.string().max(50_000),
      notes: z.string().trim().min(1).max(4_000),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = generateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid planner request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { accountId, ...plannerPayload } = parsed.data;

  // Personal account id matches auth user id; otherwise require membership.
  if (accountId !== user.id) {
    const { data: membership } = await client
      .from('accounts_memberships')
      .select('account_id')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const taskIds = plannerPayload.tasks.map((task) => task.id);
  let tasks = plannerPayload.tasks;

  if (taskIds.length > 0) {
    const { data: visibleTasks, error } = await client
      .from('tasks')
      .select('id')
      .in('id', taskIds)
      .neq('status', 'done')
      .neq('status', 'completed')
      .neq('status', 'cancelled');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const visibleIds = new Set((visibleTasks ?? []).map((task) => task.id));
    tasks = tasks.filter((task) => visibleIds.has(task.id));
  }

  // A re-plan can run on notes alone; a fresh plan needs at least one task.
  if (tasks.length === 0 && !plannerPayload.replan) {
    return NextResponse.json(
      { error: 'No visible open tasks selected' },
      { status: 400 },
    );
  }

  try {
    const stream = await streamPlannerMarkdown(
      {
        ...plannerPayload,
        user_id: user.id,
        tasks,
      },
      { accountId, supabase: client },
    );

    return new Response(stream, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    if (isInsufficientCreditsError(err)) {
      return NextResponse.json(insufficientCreditsResponse(err), {
        status: 402,
      });
    }

    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Could not generate planner',
      },
      { status: 502 },
    );
  }
}
