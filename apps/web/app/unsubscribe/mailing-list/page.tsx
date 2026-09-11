import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  loadWorkspaceNameForPreference,
  lookupMailingListPublicPreference,
  unsubscribeMailingListPublicPreference,
} from '~/lib/workspace-forms/mailing-list-public-preference';

import { MailingListPreferenceForm } from './_components/mailing-list-preference-form';

export const metadata = {
  title: 'Unsubscribe from mailing list',
};

export const dynamic = 'force-dynamic';

export default async function MailingListUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const { token, status } = await searchParams;
  let error: string | null = null;
  let email: string | null = null;
  let workspaceName = 'this workspace';
  let subscribed = false;
  let canResubscribe = false;

  if (token) {
    try {
      const admin = getSupabaseServerAdminClient();
      const result =
        status === 'subscribed'
          ? await lookupMailingListPublicPreference(admin, token)
          : await unsubscribeMailingListPublicPreference(admin, token);

      if (!result) {
        error = 'This unsubscribe link is missing or invalid.';
      } else {
        email = result.email;
        subscribed = result.marketingStatus === 'subscribed';
        canResubscribe = result.marketingStatus !== 'suppressed';
        workspaceName = await loadWorkspaceNameForPreference(
          admin,
          result.accountId,
        );
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to update preference';
    }
  } else {
    error = 'This unsubscribe link is missing or invalid.';
  }

  const success = Boolean(email && !error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ozer-surface-canvas)] px-6 py-12">
      <div className="w-full max-w-lg rounded-3xl bg-[var(--ozer-surface-panel)] p-8 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-[var(--workspace-shell-text)]">
          {!success
            ? 'Invalid unsubscribe link'
            : subscribed
              ? "You're subscribed again"
              : 'You have been unsubscribed'}
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--workspace-shell-text-muted)]">
          {!success
            ? error
            : subscribed
              ? `${email} will receive mailing-list emails from ${workspaceName} again.`
              : `${email} will no longer receive mailing-list emails from ${workspaceName}.`}
        </p>
        {success && token && (subscribed || canResubscribe) ? (
          <MailingListPreferenceForm token={token} subscribed={subscribed} />
        ) : null}
      </div>
    </main>
  );
}
