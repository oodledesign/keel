'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import {
  type ContentSubmissionType,
  REWARDS_CONFIG,
  contentTierRewardPence,
} from '~/config/rewards.config';

const CreditTargetSchema = z.object({
  target: z.enum(['personal', 'workspace']),
  workspaceId: z.string().uuid().nullable(),
});

export const updateRewardCreditTargetAction = enhanceAction(
  async (data, user) => {
    const parsed = CreditTargetSchema.parse(data);
    const client = getSupabaseServerClient();

    if (parsed.target === 'workspace') {
      if (!parsed.workspaceId) {
        throw new Error('Select a workspace for credit destination.');
      }

      const { data: membership } = await client
        .from('accounts_memberships')
        .select('account_id')
        .eq('account_id', parsed.workspaceId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) {
        throw new Error('You do not have access to that workspace.');
      }
    }

    const { error } = await client.from('user_settings').upsert(
      {
        user_id: user.id,
        reward_credit_target: parsed.target,
        reward_credit_workspace_id:
          parsed.target === 'workspace' ? parsed.workspaceId : null,
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(pathsConfig.app.personalAccountRewardsSettings);
    return { success: true };
  },
  { auth: true },
);

const ContentSubmissionSchema = z.object({
  contentType: z.enum(['story', 'image_post', 'reel']),
  postUrl: z.string().url().optional().or(z.literal('')),
  screenshotPath: z.string().optional(),
});

export const submitContentRewardAction = enhanceAction(
  async (data, user) => {
    const parsed = ContentSubmissionSchema.parse(data);
    const postUrl = parsed.postUrl?.trim() || null;
    const screenshotPath = parsed.screenshotPath?.trim() || null;

    if (!postUrl && !screenshotPath) {
      throw new Error('Add a post URL or upload a screenshot.');
    }

    const rewardAmountPence = contentTierRewardPence(
      parsed.contentType as ContentSubmissionType,
    );

    const client = getSupabaseServerClient();

    const { data: exceeds } = await client.rpc(
      'content_reward_would_exceed_caps',
      {
        p_user_id: user.id,
        p_new_amount_pence: rewardAmountPence,
        p_monthly_cap_pence: REWARDS_CONFIG.contentMonthlyCapPence,
        p_annual_cap_pence: REWARDS_CONFIG.contentAnnualCapPence,
      },
    );

    if (exceeds) {
      throw new Error(
        'This submission would exceed your monthly (£20) or annual (£180) content reward cap.',
      );
    }

    const { error } = await client.from('content_submissions').insert({
      user_id: user.id,
      content_type: parsed.contentType,
      post_url: postUrl,
      screenshot_path: screenshotPath,
      reward_amount_pence: rewardAmountPence,
      status: 'pending',
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(pathsConfig.app.personalAccountRewardsSettings);
    return { success: true };
  },
  { auth: true },
);
