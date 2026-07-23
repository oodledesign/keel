import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddon } from '~/lib/rankly/require-rankly-api-access';
import { listGscSites } from '~/lib/rankly-gsc/client';
import {
  deleteGscConnection,
  getValidGscAccessToken,
  loadGscConnection,
  toGscConnectionStatus,
  updateGscProperty,
} from '~/lib/rankly-gsc/connection';
import { pickBestGscProperty } from '~/lib/rankly-gsc/domain';
import { isGscConfigured } from '~/lib/rankly-gsc/env';
import { loadTopGscQueries } from '~/lib/rankly-gsc/metrics';
import { syncProjectGscMetrics } from '~/lib/rankly-gsc/sync';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const runtime = 'nodejs';
export const maxDuration = 120;

const querySchema = z.object({
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
});

const propertySchema = z.object({
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
  propertyUri: z.string().trim().min(1).max(500),
});

async function assertProjectAccess(
  client: SupabaseClient,
  userId: string,
  projectId: string,
  accountId: string,
) {
  const isMember = await userIsAccountMember(client, userId, accountId);
  if (!isMember) {
    return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
  }

  const addonDenied = await denyUnlessRanklyAddon(client, userId, accountId);
  if (addonDenied) return addonDenied;

  const { data: project } = await supabaseCustomSchema(client, 'rankly')
    .from('projects')
    .select('id, domain')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (!project) {
    return jsonErr('NOT_FOUND', 'Project not found', 404);
  }

  return { project: project as { id: string; domain: string } };
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

    const access = await assertProjectAccess(
      client,
      user.id,
      parsed.data.projectId,
      parsed.data.accountId,
    );
    if (access instanceof Response) return access;

    const connection = await loadGscConnection(client, parsed.data.projectId);
    const status = toGscConnectionStatus(connection);

    let sites: Array<{ siteUrl: string; permissionLevel: string | null }> = [];
    let suggestedProperty: string | null = null;

    if (connection) {
      try {
        const accessToken = await getValidGscAccessToken(client, connection);
        sites = await listGscSites(accessToken);
        suggestedProperty = pickBestGscProperty(
          sites.map((site) => site.siteUrl),
          access.project.domain,
        );
      } catch (error) {
        status.lastSyncError =
          error instanceof Error
            ? error.message
            : 'Could not list Search Console properties';
      }
    }

    const topQueries = connection?.property_uri
      ? await loadTopGscQueries(client, parsed.data.projectId, {
          days: 28,
          limit: 15,
        })
      : [];

    return jsonOk({
      status: {
        ...status,
        configured: isGscConfigured(),
      },
      sites,
      suggestedProperty,
      topQueries,
    });
  } catch (error) {
    console.error('[rankly] gsc GET', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to load GSC status',
      500,
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const body = await request.json();
    const parsed = propertySchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400, parsed.error.flatten());
    }

    const access = await assertProjectAccess(
      client,
      user.id,
      parsed.data.projectId,
      parsed.data.accountId,
    );
    if (access instanceof Response) return access;

    const connection = await loadGscConnection(client, parsed.data.projectId);
    if (!connection) {
      return jsonErr('NOT_FOUND', 'Search Console is not connected', 404);
    }

    await updateGscProperty(
      client,
      parsed.data.projectId,
      parsed.data.propertyUri,
    );

    return jsonOk({ propertyUri: parsed.data.propertyUri });
  } catch (error) {
    console.error('[rankly] gsc PATCH', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to update property',
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

    const body = (await request.json()) as {
      projectId?: string;
      accountId?: string;
    };
    const parsed = querySchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400, parsed.error.flatten());
    }

    const access = await assertProjectAccess(
      client,
      user.id,
      parsed.data.projectId,
      parsed.data.accountId,
    );
    if (access instanceof Response) return access;

    const result = await syncProjectGscMetrics(client, parsed.data.projectId);
    return jsonOk(result);
  } catch (error) {
    console.error('[rankly] gsc POST sync', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Sync failed',
      500,
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    const access = await assertProjectAccess(
      client,
      user.id,
      parsed.data.projectId,
      parsed.data.accountId,
    );
    if (access instanceof Response) return access;

    await deleteGscConnection(client, parsed.data.projectId);
    return jsonOk({ disconnected: true });
  } catch (error) {
    console.error('[rankly] gsc DELETE', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to disconnect',
      500,
    );
  }
}
