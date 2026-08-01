import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { SuggestedEmailTasksClient } from '~/home/[account]/email/suggested-tasks/_components/suggested-email-tasks-client';
import { redirectIfEmailAssistantNotAllowed } from '~/lib/billing/require-email-assistant-access';
import { loadSuggestedEmailActionItems } from '~/lib/email-assistant/suggested-email-tasks.loader';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Email tasks to review',
};

async function PersonalSuggestedEmailTasksPage() {
  const [user] = await Promise.all([
    requireUserInServerComponent(),
    redirectIfEmailAssistantNotAllowed(),
  ]);

  const client = getSupabaseServerClient();
  const { items, totalCount } = await loadSuggestedEmailActionItems(
    client,
    user.id,
    { limit: 50 },
  );

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] p-0 md:p-0">
      <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-5 lg:px-6">
        <h1 className="text-xl font-semibold text-[var(--workspace-shell-text)]">
          Email tasks to review
        </h1>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Confirm clear requests from emails that need a reply before they
          become planner tasks.
        </p>
      </div>
      <SuggestedEmailTasksClient initialItems={items} totalCount={totalCount} />
    </PageBody>
  );
}

export default withI18n(PersonalSuggestedEmailTasksPage);
