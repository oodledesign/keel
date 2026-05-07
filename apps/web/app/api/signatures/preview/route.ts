import { type NextRequest, NextResponse } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { jsonErr } from '~/lib/rankly/api-response';
import { assertAccountMember } from '~/lib/signatures/account-access';
import {
  loadDepartmentBadgeUrl,
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

    const [departmentBadgeUrl, brand] = await Promise.all([
      loadDepartmentBadgeUrl(
        accountId,
        (staffRow as SignaturesStaffRow).department,
      ),
      loadAccountBrandResolved(accountId),
    ]);
    const html = renderTemplate(
      templateRow.html_template as string,
      staffRow as SignaturesStaffRow,
      { awardBadgeUrl: departmentBadgeUrl, brand },
    );

    return new NextResponse(html, {
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
