import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  loadSeoReportSnapshot,
  updateSeoReportShare,
} from '~/lib/rankly-seo-report/db';
import { buildPublicSeoReportUrl } from '~/lib/rankly-seo-report/public-url';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddonForProject } from '~/lib/rankly/require-rankly-api-access';

export const runtime = 'nodejs';

const bodySchema = z.object({
  enabled: z.boolean(),
  rotateToken: z.boolean().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const existing = await loadSeoReportSnapshot(id);
    if (!existing) {
      return jsonErr('NOT_FOUND', 'Report not found', 404);
    }

    const addonDenied = await denyUnlessRanklyAddonForProject(
      client,
      user.id,
      existing.project_id,
    );
    if (addonDenied) return addonDenied;

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400, parsed.error.flatten());
    }

    const report = await updateSeoReportShare({
      reportId: id,
      enabled: parsed.data.enabled,
      rotateToken: parsed.data.rotateToken,
    });

    return jsonOk({
      id: report.id,
      publicShareEnabled: report.public_share_enabled,
      token: report.public_share_token,
      publicUrl:
        report.public_share_enabled && report.public_share_token
          ? buildPublicSeoReportUrl(report.public_share_token)
          : null,
    });
  } catch (error) {
    console.error('[rankly] seo-report share PATCH', error);
    return jsonErr(
      'UNKNOWN',
      error instanceof Error ? error.message : 'Failed to update share',
      500,
    );
  }
}
