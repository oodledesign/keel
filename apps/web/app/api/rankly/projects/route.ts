import { type NextRequest } from 'next/server';
import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';
import { createProjectSchema } from '~/lib/rankly/validations/project';

const accountIdQuery = z.string().uuid();

export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseServerClient() as SupabaseClient;
    const { data: sessionData } = await client.auth.getUser();
    if (!sessionData.user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const rawAccountId = request.nextUrl.searchParams.get('account_id');
    const parsedId = accountIdQuery.safeParse(rawAccountId);
    if (!parsedId.success) {
      return jsonErr(
        'VALIDATION',
        'Query parameter account_id (uuid) is required',
        400,
      );
    }

    const account_id = parsedId.data;

    const isMember = await userIsAccountMember(
      client,
      sessionData.user.id,
      account_id,
    );

    if (!isMember) {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const { data, error } = await supabaseCustomSchema(client, 'rankly')
      .from('projects')
      .select('*')
      .eq('account_id', account_id)
      .order('created_at', { ascending: false });

    if (error) return jsonErr('DB_ERROR', error.message, 500);
    return jsonOk(data ?? []);
  } catch (e) {
    return jsonErr(
      'UNKNOWN',
      e instanceof Error ? e.message : 'Error',
      500,
    );
  }
}

export async function POST(request: Request) {
  try {
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400, parsed.error.flatten());
    }

    const { account_id, ...rest } = parsed.data;

    const isMember = await userIsAccountMember(client, user.id, account_id);

    if (!isMember) {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const { data, error } = await supabaseCustomSchema(client, 'rankly')
      .from('projects')
      .insert({
        account_id,
        ...rest,
      })
      .select('*')
      .single();

    if (error) return jsonErr('DB_ERROR', error.message, 500);
    return jsonOk(data);
  } catch (e) {
    return jsonErr(
      'UNKNOWN',
      e instanceof Error ? e.message : 'Error',
      500,
    );
  }
}
