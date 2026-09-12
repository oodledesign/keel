import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { clientIpFromRequest, isRateLimited } from '~/lib/rate-limit/in-memory';
import { uploadWorkspaceFormFile } from '~/lib/workspace-forms/form-file.server';
import { loadPublicWorkspaceFormByToken } from '~/lib/workspace-forms/public-form';

export const runtime = 'nodejs';

/** Same embed CORS as submit/draft — public forms can live on listing sites. */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Invalid form data' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const token = String(formData.get('token') ?? '').trim();
  const fieldKey = String(formData.get('fieldKey') ?? '').trim();
  const file = formData.get('file');

  if (!token || token.length < 16) {
    return NextResponse.json(
      { error: 'This form is unavailable.' },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const ip = clientIpFromRequest(request);
  if (isRateLimited(`workspace-form-upload:${token}:${ip}`, 20)) {
    return NextResponse.json(
      { error: 'Too many uploads. Please try again shortly.' },
      { status: 429, headers: CORS_HEADERS },
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Please choose a file.' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const admin = getSupabaseServerAdminClient();
  const form = await loadPublicWorkspaceFormByToken(admin, token);

  if (!form) {
    return NextResponse.json(
      { error: 'This form is unavailable.' },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const field = form.fields.find((item) => item.key === fieldKey);
  if (!field || field.type !== 'file') {
    return NextResponse.json(
      { error: 'This question does not accept a file.' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  try {
    const uploaded = await uploadWorkspaceFormFile({
      admin,
      accountId: form.accountId,
      formId: form.id,
      file,
    });
    return NextResponse.json(
      { ok: true, file: uploaded },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not upload that file.';
    return NextResponse.json(
      { error: message },
      { status: 400, headers: CORS_HEADERS },
    );
  }
}
