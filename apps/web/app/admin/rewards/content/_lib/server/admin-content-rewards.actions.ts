'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { adminAction } from '@kit/admin';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { REWARDS_CONFIG } from '~/config/rewards.config';
import { applyStripeCustomerBalanceCredit } from '~/lib/rewards/apply-stripe-customer-balance-credit';

const ReviewSchema = z.object({
  submissionId: z.string().uuid(),
  decision: z.enum(['approve', 'reject']),
  followOzerConfirmed: z.boolean().optional(),
  followerCount: z.coerce.number().int().optional(),
  accountAgeDays: z.coerce.number().int().optional(),
  reviewNotes: z.string().max(2000).optional(),
  rejectionReason: z.string().max(2000).optional(),
});

export const reviewContentSubmissionAction = adminAction(
  enhanceAction(
    async (data, user) => {
      const parsed = ReviewSchema.parse(data);
      const admin = getSupabaseServerAdminClient();

      const { data: submission, error: loadError } = await admin
        .from('content_submissions')
        .select('*')
        .eq('id', parsed.submissionId)
        .eq('status', 'pending')
        .maybeSingle();

      if (loadError || !submission) {
        throw new Error('Submission not found or already reviewed.');
      }

      if (parsed.decision === 'reject') {
        const { error } = await admin
          .from('content_submissions')
          .update({
            status: 'rejected',
            rejection_reason: parsed.rejectionReason ?? 'Did not meet guidelines',
            review_notes: parsed.reviewNotes ?? null,
            reviewer_user_id: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', submission.id);

        if (error) throw new Error(error.message);

        revalidatePath('/admin/rewards/content');
        return { success: true };
      }

      if (!parsed.followOzerConfirmed) {
        throw new Error('Confirm the account follows @ozer.so before approving.');
      }

      const followerCount = parsed.followerCount ?? 0;
      const accountAgeDays = parsed.accountAgeDays ?? 0;

      if (followerCount < REWARDS_CONFIG.minFollowerCount) {
        throw new Error(
          `Follower count must be at least ${REWARDS_CONFIG.minFollowerCount}.`,
        );
      }

      if (accountAgeDays < REWARDS_CONFIG.minAccountAgeDays) {
        throw new Error(
          `Account age must be at least ${REWARDS_CONFIG.minAccountAgeDays} days.`,
        );
      }

      const rewardAmountPence =
        submission.reward_amount_pence ??
        REWARDS_CONFIG.contentTiersPence[
          submission.content_type as keyof typeof REWARDS_CONFIG.contentTiersPence
        ];

      const { data: locked, error: lockError } = await admin
        .from('content_submissions')
        .update({
          status: 'approved',
          reward_amount_pence: rewardAmountPence,
          follow_ozer_confirmed: parsed.followOzerConfirmed,
          follower_count_at_review: followerCount,
          account_age_days_at_review: accountAgeDays,
          review_notes: parsed.reviewNotes ?? null,
          reviewer_user_id: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submission.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (lockError) throw new Error(lockError.message);
      if (!locked) {
        throw new Error('Submission not found or already reviewed.');
      }

      await applyStripeCustomerBalanceCredit({
        admin,
        userId: submission.user_id,
        amountPence: rewardAmountPence,
        source: 'content',
        description: 'Content reward — social post about Ozer',
        sourceContentSubmissionId: submission.id,
      });

      revalidatePath('/admin/rewards/content');
      return { success: true };
    },
    { auth: true, schema: ReviewSchema },
  ),
);
