import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type CreatePipelineLeadFromCommentResult = {
  dealId: string;
};

export async function createPipelineLeadFromComment(
  client: SupabaseClient,
  params: {
    accountId: string;
    commenterUsername: string | null;
    commentText: string;
    stage: string;
  },
): Promise<CreatePipelineLeadFromCommentResult> {
  const contactName = params.commenterUsername
    ? `@${params.commenterUsername.replace(/^@/, '')}`
    : 'Instagram commenter';
  const companyName = contactName;
  const description = params.commentText.trim().slice(0, 4000) || null;
  const dealName = `Instagram: ${contactName}`;

  const { data, error } = await client
    .from('pipeline_deals')
    .insert({
      name: dealName,
      contact_name: contactName,
      company_name: companyName,
      notes: description,
      value: 0,
      stage: params.stage || 'lead',
      source: 'social',
      business_id: null,
      account_id: params.accountId,
      client_id: null,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create pipeline deal');
  }

  const dealId = String((data as { id: string }).id);

  const admin = getSupabaseServerAdminClient();
  const { error: activityError } = await admin
    .from('pipeline_activities')
    .insert({
      deal_id: dealId,
      user_id: null,
      type: 'instagram_comment',
      content: `Lead created from Instagram comment by ${contactName}`,
      occurred_at: new Date().toISOString(),
    });

  if (activityError) {
    console.error(
      '[instagram-autoreply] pipeline_activities insert failed',
      activityError.message,
    );
  }

  return { dealId };
}
