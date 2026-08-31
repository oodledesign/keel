import { NextResponse } from 'next/server';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { buildMarketingSiteUrl } from '~/lib/app-host-routing';
import { getMetaAppSecrets } from '~/lib/meta/app-secrets';
import { createMetaDataDeletionService } from '~/lib/meta/data-deletion.service';
import { parseMetaSignedRequest } from '~/lib/meta/signed-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readSignedRequest(request: Request): Promise<string | null> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      const body = (await request.json()) as { signed_request?: unknown };
      return typeof body.signed_request === 'string'
        ? body.signed_request
        : null;
    } catch {
      return null;
    }
  }

  try {
    const form = await request.formData();
    const value = form.get('signed_request');
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

function statusUrl(confirmationCode: string) {
  return buildMarketingSiteUrl(
    `/data-deletion/status?code=${encodeURIComponent(confirmationCode)}`,
  );
}

export async function GET() {
  return NextResponse.json({
    message:
      'Meta data deletion callback. POST signed_request from Meta App settings.',
    instructions: '/data-deletion',
  });
}

export async function POST(request: Request) {
  const logger = await getLogger();
  const secrets = getMetaAppSecrets();

  if (secrets.length === 0) {
    logger.error(
      { name: 'meta-data-deletion' },
      'No Meta app secret configured',
    );
    return NextResponse.json(
      { error: 'Data deletion is not configured' },
      { status: 500 },
    );
  }

  const signedRequest = await readSignedRequest(request);
  const payload = signedRequest
    ? parseMetaSignedRequest(signedRequest, secrets)
    : null;

  if (!payload) {
    logger.warn(
      { name: 'meta-data-deletion', hasSignedRequest: Boolean(signedRequest) },
      'Invalid Meta signed_request',
    );
    return NextResponse.json(
      { error: 'Invalid signed_request' },
      { status: 400 },
    );
  }

  try {
    const admin = getSupabaseServerAdminClient();
    const service = createMetaDataDeletionService(admin);
    const result = await service.processForMetaUser(payload.user_id);

    logger.info(
      {
        name: 'meta-data-deletion',
        confirmationCode: result.confirmationCode,
        status: result.status,
        deletedIgConnections: result.deletedIgConnections,
        deletedFeedflowAccounts: result.deletedFeedflowAccounts,
      },
      'Processed Meta data deletion request',
    );

    return NextResponse.json({
      url: statusUrl(result.confirmationCode),
      confirmation_code: result.confirmationCode,
    });
  } catch (error) {
    logger.error(
      {
        name: 'meta-data-deletion',
        error: error instanceof Error ? error.message : error,
      },
      'Meta data deletion request failed',
    );
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
