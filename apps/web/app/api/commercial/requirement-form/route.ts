import { NextResponse } from 'next/server';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  loadPublicRequirementFormByToken,
  upsertRequirementFromPublicForm,
} from '~/lib/commercial/circulation/public-requirement-form';
import { PublicRequirementFormSubmitSchema } from '~/lib/commercial/circulation/public-requirement-form.schema';
import {
  isRequirementFormRateLimited,
  requirementFormRateLimitResponse,
} from '~/lib/rate-limit/requirement-form-rate-limit';

/**
 * POST /api/commercial/requirement-form
 * Public intake for the website embed (token-gated via admin client).
 */
export const POST = enhanceRouteHandler(
  async ({ request }) => {
    if (isRequirementFormRateLimited(request)) {
      return requirementFormRateLimitResponse();
    }

    const body = await request.json().catch(() => null);
    const parsed = PublicRequirementFormSubmitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid submission', issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const admin = getSupabaseServerAdminClient();
    const form = await loadPublicRequirementFormByToken(
      admin,
      parsed.data.token,
    );

    if (!form) {
      return NextResponse.json(
        { error: 'Form not found or disabled' },
        { status: 404 },
      );
    }

    try {
      const result = await upsertRequirementFromPublicForm(admin, form, {
        contactName: parsed.data.contactName,
        contactEmail: parsed.data.contactEmail,
        contactPhone: parsed.data.contactPhone,
        companyName: parsed.data.companyName,
        branchId: parsed.data.branchId,
        sector: parsed.data.sector,
        tenure: parsed.data.tenure,
        locationText: parsed.data.locationText,
        searchRadiusMiles: parsed.data.searchRadiusMiles,
        sizeMinSqft: parsed.data.sizeMinSqft,
        sizeMaxSqft: parsed.data.sizeMaxSqft,
        budgetMinPence: parsed.data.budgetMinPence,
        budgetMaxPence: parsed.data.budgetMaxPence,
        notes: parsed.data.notes,
      });

      return NextResponse.json({
        ok: true,
        created: result.created,
        requirementId: result.requirementId,
        message:
          form.successMessage ||
          'Thank you — we have received your requirement.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'Unknown office') {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      console.error(
        '[requirement-form] upsert failed:',
        err instanceof Error ? err.message : err,
      );
      return NextResponse.json(
        { error: 'Could not save requirement' },
        { status: 500 },
      );
    }
  },
  { auth: false },
);
