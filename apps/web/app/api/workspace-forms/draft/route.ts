import { NextResponse } from 'next/server';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { clientIpFromRequest, isRateLimited } from '~/lib/rate-limit/in-memory';
import {
  publicOriginFromRequest,
  savePublicFormDraft,
} from '~/lib/workspace-forms/form-draft.server';
import { shouldIncludeWelcomeStep } from '~/lib/workspace-forms/form-steps';
import { PublicWorkspaceFormDraftSchema } from '~/lib/workspace-forms/form.schema';
import { loadPublicWorkspaceFormByToken } from '~/lib/workspace-forms/public-form';

export const runtime = 'nodejs';

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
        { ok: true, emailed: false, resumeUrl: '' },
        { headers: CORS_HEADERS },
      );
    }

    const ip = clientIpFromRequest(request);
    if (isRateLimited(`workspace-form-draft:${body.token}:${ip}`, 20)) {
      return NextResponse.json(
        { error: 'Too many save attempts. Please try again shortly.' },
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

    const embed = body.embed === true;
    const includeWelcome = shouldIncludeWelcomeStep({
      presentation: form.theme.presentation,
      layout: form.theme.layout,
      embed,
      hasIntro: Boolean(
        form.description?.trim() ||
        form.eventAddress?.trim() ||
        form.eventDate?.trim() ||
        form.eventTime?.trim(),
      ),
    });

    try {
      const saved = await savePublicFormDraft(admin, {
        form,
        values: body.values,
        stepIndex: body.stepIndex ?? 0,
        resumeToken: body.resumeToken,
        includeWelcome,
        siteUrl: publicOriginFromRequest(request),
        embed,
        listingId: body.listingId,
        propertyId: body.propertyId,
      });

      return NextResponse.json(
        {
          ok: true,
          resumeToken: saved.draft.resumeToken,
          resumeUrl: saved.resumeUrl,
          emailed: saved.emailed,
          email: saved.email,
        },
        { headers: CORS_HEADERS },
      );
    } catch (error) {
      console.error(
        '[workspace-forms] draft save failed:',
        error instanceof Error ? error.message : error,
      );
      return NextResponse.json(
        { error: 'Could not save your answers. Please try again.' },
        { status: 500, headers: CORS_HEADERS },
      );
    }
  },
  { auth: false, schema: PublicWorkspaceFormDraftSchema },
);
