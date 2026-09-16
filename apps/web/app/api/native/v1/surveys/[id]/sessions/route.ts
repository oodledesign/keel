import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { createNativeSurveySession } from '~/lib/native/surveys';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateSessionBodySchema = z.object({
  workspace: z.string().min(1),
  title: z.string().max(500).optional().nullable(),
  content: z.string().max(120_000).optional().nullable(),
  duration_seconds: z.number().nonnegative().optional().nullable(),
  meeting_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  source: z
    .enum(['paste', 'upload', 'desktop_recorder', 'iphone'])
    .optional()
    .nullable(),
  rics_code: z.string().max(40).optional().nullable(),
  section_key: z.string().max(80).optional().nullable(),
});

async function readSessionPayload(request: Request): Promise<{
  workspace: string;
  title?: string | null;
  content: string;
  durationSeconds?: number | null;
  meetingDate?: string | null;
  source?: string | null;
  ricsCode?: string | null;
  audio: {
    bytes: Buffer;
    filename: string;
    mimeType: string;
  } | null;
}> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new Error('Invalid form data');
    }
    const file = form.get('file');
    const audio =
      file instanceof File
        ? {
            bytes: Buffer.from(await file.arrayBuffer()),
            filename: file.name || 'recording.m4a',
            mimeType: file.type || 'audio/mp4',
          }
        : null;
    return {
      workspace: String(form.get('workspace') ?? '').trim(),
      title: String(form.get('title') ?? '').trim() || null,
      content: String(form.get('content') ?? '').slice(0, 120_000),
      durationSeconds: Number(form.get('duration_seconds') ?? '') || null,
      meetingDate: String(form.get('meeting_date') ?? '').trim() || null,
      source: String(form.get('source') ?? '').trim() || 'iphone',
      ricsCode:
        String(form.get('rics_code') ?? form.get('section_key') ?? '').trim() ||
        null,
      audio,
    };
  }

  const parsed = CreateSessionBodySchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    throw new Error('Invalid request body');
  }
  return {
    workspace: parsed.data.workspace,
    title: parsed.data.title,
    content: parsed.data.content ?? '',
    durationSeconds: parsed.data.duration_seconds,
    meetingDate: parsed.data.meeting_date,
    source: parsed.data.source,
    ricsCode:
      parsed.data.rics_code?.trim() || parsed.data.section_key?.trim() || null,
    audio: null,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const payload = await readSessionPayload(request);
    if (!payload.workspace) {
      return nativeBadRequest('workspace is required');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      payload.workspace,
    );
    const result = await createNativeSurveySession({
      client: auth.context.supabase,
      userId: auth.context.userId,
      workspace,
      surveyId: id,
      title: payload.title,
      content: payload.content,
      durationSeconds: payload.durationSeconds,
      meetingDate: payload.meetingDate,
      source: payload.source,
      ricsCode: payload.ricsCode,
      audio: payload.audio,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid request body') {
      return nativeBadRequest(error.message);
    }
    if (error instanceof Error && error.message === 'Invalid form data') {
      return nativeBadRequest(error.message);
    }
    return handleNativeError(error, 'surveys');
  }
}
