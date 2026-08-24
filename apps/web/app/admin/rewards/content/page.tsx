import { AdminGuard } from '@kit/admin/components/admin-guard';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { PageBody, PageHeader } from '@kit/ui/page';

import {
  AdminContentRewardsTable,
  type AdminContentSubmissionRow,
} from './_components/admin-content-rewards-table';

export const metadata = { title: 'Content rewards' };

async function AdminContentRewardsPage() {
  const client = getSupabaseServerAdminClient();

  const { data: submissions, error } = await client
    .from('content_submissions')
    .select(
      'id, user_id, content_type, post_url, screenshot_path, reward_amount_pence, created_at',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[admin/rewards/content] load failed', error.message);
  }

  const userIds = [...new Set((submissions ?? []).map((s) => s.user_id))];
  const emailByUser = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: accounts } = await client
      .from('accounts')
      .select('id, email')
      .in('id', userIds);

    for (const account of accounts ?? []) {
      if (account.email) {
        emailByUser.set(account.id, account.email);
      }
    }
  }

  const rows: AdminContentSubmissionRow[] = (submissions ?? []).map((s) => ({
    id: s.id,
    user_id: s.user_id,
    user_email: emailByUser.get(s.user_id) ?? null,
    content_type: s.content_type,
    post_url: s.post_url,
    screenshot_path: s.screenshot_path,
    reward_amount_pence: s.reward_amount_pence,
    created_at: s.created_at,
  }));

  return (
    <>
      <PageHeader
        title="Content rewards"
        description="Review social posts about Ozer and grant Stripe customer balance credit."
      />
      <PageBody className="max-w-6xl py-4">
        {error ? (
          <p className="text-destructive mb-4 text-sm">
            Could not load submissions: {error.message}
          </p>
        ) : null}
        <AdminContentRewardsTable submissions={rows} />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminContentRewardsPage);
