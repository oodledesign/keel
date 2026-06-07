import { type NextRequest } from 'next/server';
import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  assertProjectForOverview,
  isSiteOverviewStale,
  loadSiteOverviewForProject,
  refreshSiteOverview,
} from '~/lib/site-overview/db';
import { projectCountryToCode } from '~/lib/site-overview/domain';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { userIsAccountMember } from '~/lib/rankly/account-membership';

export const runtime = 'nodejs';
export const maxDuration = 300;

const querySchema = z.object({
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
});

const refreshSchema = z.object({
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
  force: z.boolean().optional(),
});

async function assertAccess(
  client: SupabaseClient,
  userId: string,
  projectId: string,
  accountId: string,
) {
  const isMember = await userIsAccountMember(client, userId, accountId);
  if (!isMember) {
    return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
  }

  const project = await assertProjectForOverview(client, projectId, accountId);
  if (!project) {
    return jsonErr('NOT_FOUND', 'Project not found', 404);
  }

  return project;
}

export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const parsed = querySchema.safeParse({
      projectId: request.nextUrl.searchParams.get('projectId'),
      accountId: request.nextUrl.searchParams.get('accountId'),
    });

    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid query', 400, parsed.error.flatten());
    }

    const access = await assertAccess(
      client,
      user.id,
      parsed.data.projectId,
      parsed.data.accountId,
    );
    if (access instanceof Response) return access;

    const overview = await loadSiteOverviewForProject(parsed.data.projectId);

    return jsonOk({
      overview,
      stale: isSiteOverviewStale(overview),
    });
  } catch (error) {
    console.error('[rankly] site-overview GET', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to load site overview',
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const body = await request.json();
    const parsed = refreshSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400, parsed.error.flatten());
    }

    const access = await assertAccess(
      client,
      user.id,
      parsed.data.projectId,
      parsed.data.accountId,
    );
    if (access instanceof Response) return access;

    const existing = await loadSiteOverviewForProject(parsed.data.projectId);
    if (!parsed.data.force && existing && !isSiteOverviewStale(existing)) {
      return jsonOk({ overview: existing, stale: false, refreshed: false });
    }

    const { overview, warnings } = await refreshSiteOverview({
      projectId: parsed.data.projectId,
      domain: access.domain,
      countryCode: projectCountryToCode(access.target_country),
    });

    return jsonOk({ overview, stale: false, refreshed: true, warnings });
  } catch (error) {
    console.error('[rankly] site-overview POST', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to refresh site overview',
      500,
    );
  }
}
