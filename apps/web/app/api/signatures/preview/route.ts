import { type NextRequest, NextResponse } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadSignatureRenderOptions } from '~/lib/signatures/render-context';
import { jsonErr } from '~/lib/rankly/api-response';
import { assertAccountMember } from '~/lib/signatures/account-access';
import { denyUnlessSignaturesAddon } from '~/lib/signatures/require-signatures-api-access';
import {
  type SignaturesStaffRow,
  getSignaturesSupabaseClient,
  renderTemplate,
} from '~/lib/signatures/graph';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const staffId = request.nextUrl.searchParams.get('staffId');
    const templateId = request.nextUrl.searchParams.get('templateId');
    if (!staffId?.match(/^[0-9a-f-]{36}$/i) || !templateId?.match(/^[0-9a-f-]{36}$/i)) {
      return jsonErr(
        'VALIDATION',
        'Query parameters staffId and templateId (uuids) are required',
        400,
      );
    }

    const db = getSignaturesSupabaseClient();

    const { data: staffRow, error: se } = await db
      .from('staff')
      .select('*')
      .eq('id', staffId)
      .maybeSingle();

    if (se) {
      return jsonErr('DB_ERROR', se.message, 500);
    }
    if (!staffRow) {
      return jsonErr('NOT_FOUND', 'Staff not found', 404);
    }

    const accountId = staffRow.account_id as string;
    const memberErr = await assertAccountMember(client, accountId, user.id);
    if (memberErr) return memberErr;

    const addonDenied = await denyUnlessSignaturesAddon(client, user.id, accountId);
    if (addonDenied) return addonDenied;

    const { data: templateRow, error: te } = await db
      .from('templates')
      .select('html_template, account_id')
      .eq('id', templateId)
      .maybeSingle();

    if (te) {
      return jsonErr('DB_ERROR', te.message, 500);
    }
    if (!templateRow || templateRow.account_id !== accountId) {
      return jsonErr('NOT_FOUND', 'Template not found', 404);
    }

    const renderOptions = await loadSignatureRenderOptions(accountId, staffRow as SignaturesStaffRow);
    const html = renderTemplate(
      templateRow.html_template as string,
      staffRow as SignaturesStaffRow,
      renderOptions,
    );

    const themeParam = request.nextUrl.searchParams.get('theme');
    const theme = themeParam === 'dark' ? 'dark' : 'light';
    const chrome = theme === 'dark' ? '#1c1c1e' : '#ffffff';
    const documentHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="color-scheme" content="light dark" />
<style>
  html, body { margin: 0; padding: 0; background: ${chrome}; }
  body { padding: 12px; }
</style>
</head>
<body>${html}</body>
</html>`;

    return new NextResponse(documentHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return jsonErr(
      'UNKNOWN',
      e instanceof Error ? e.message : 'Error',
      500,
    );
  }
}
