import { NextResponse } from 'next/server';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { clientIpFromRequest, isRateLimited } from '~/lib/rate-limit/in-memory';
import { PublicWorkspaceFormSubmitSchema } from '~/lib/workspace-forms/form.schema';
import {
  loadPublicWorkspaceFormByToken,
  submitPublicWorkspaceForm,
} from '~/lib/workspace-forms/public-form';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export const POST = enhanceRouteHandler(
  async ({ request, body }) => {
    if (body.website) {
      return NextResponse.json(
        { ok: true, successMessage: 'Thank you.' },
        { headers: CORS_HEADERS },
      );
    }

    const ip = clientIpFromRequest(request);
    if (isRateLimited(`workspace-form:${body.token}:${ip}`, 8)) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again shortly.' },
        { status: 429, headers: CORS_HEADERS },
      );
    }

    const admin = getSupabaseServerAdminClient();
    const form = await loadPublicWorkspaceFormByToken(admin, body.token);

    if (!form) {
      return NextResponse.json(
        { error: 'This form is unavailable.' },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    try {
      const result = await submitPublicWorkspaceForm(admin, form, body);
      return NextResponse.json(
        {
          ok: true,
          successMessage: result.successMessage,
        },
        { headers: CORS_HEADERS },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not send your enquiry.';
      const status = message.startsWith('This form needs a listing')
        ? 400
        : message.startsWith('Please enter')
          ? 400
          : 500;

      if (status === 500) {
        console.error(
          '[workspace-forms] submit failed:',
          error instanceof Error ? error.message : error,
        );
      }

      return NextResponse.json(
        {
          error:
            status === 500
              ? 'Could not send your enquiry. Please try again.'
              : message,
        },
        { status, headers: CORS_HEADERS },
      );
    }
  },
  { auth: false, schema: PublicWorkspaceFormSubmitSchema },
);
