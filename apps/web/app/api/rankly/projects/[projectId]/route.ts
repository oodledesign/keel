import { type NextRequest } from 'next/server';
import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { denyUnlessRanklyAddon } from '~/lib/rankly/require-rankly-api-access';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

const updateSchema = z.object({
  accountId: z.string().uuid(),
  brief_brand_name: z.string().trim().max(200).nullable().optional(),
  brief_voice_notes: z.string().trim().max(2000).nullable().optional(),
  brief_mention_rules: z.string().trim().max(2000).nullable().optional(),
  brief_research_depth: z.enum(['standard', 'deep']).optional(),
});

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400, parsed.error.flatten());
    }

    const isMember = await userIsAccountMember(
      client,
      user.id,
      parsed.data.accountId,
    );

    if (!isMember) {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const addonDenied = await denyUnlessRanklyAddon(client, user.id, parsed.data.accountId);
    if (addonDenied) return addonDenied;

    const { accountId, ...updates } = parsed.data;

    const { data, error } = await supabaseCustomSchema(client, 'rankly')
      .from('projects')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .eq('account_id', accountId)
      .select(
        'id, name, domain, brief_brand_name, brief_voice_notes, brief_mention_rules, brief_research_depth',
      )
      .maybeSingle();

    if (error) {
      return jsonErr('DB_ERROR', error.message, 500);
    }

    if (!data) {
      return jsonErr('NOT_FOUND', 'Project not found', 404);
    }

    return jsonOk(data);
  } catch (error) {
    return jsonErr(
      'UNKNOWN',
      error instanceof Error ? error.message : 'Error',
      500,
    );
  }
}
