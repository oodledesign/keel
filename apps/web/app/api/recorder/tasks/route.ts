import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import { createRecorderTask } from '~/lib/recorder/create-task';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateTaskBodySchema = z.object({
  title: z.string().min(1),
  account_id: z.string().uuid(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  notes: z.string().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateTaskBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  try {
    const result = await createRecorderTask({
      userId: auth.user_id,
      accountId: parsed.data.account_id,
      title: parsed.data.title,
      dueDate: parsed.data.due_date,
      priority: parsed.data.priority,
      notes: parsed.data.notes,
      projectId: parsed.data.project_id,
      clientId: parsed.data.client_id,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create task';
    const status = message.includes('not a member') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
