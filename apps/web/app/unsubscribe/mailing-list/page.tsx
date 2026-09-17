import type { ReactNode } from 'react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  loadMailingListPublicLists,
  loadWorkspaceNameForPreference,
  lookupMailingListPublicPreference,
  unsubscribeMailingListPublicPreference,
} from '~/lib/workspace-forms/mailing-list-public-preference';
import {
  mailingListPreferencePageCopy,
  mailingListUnsubscribePageCopy,
  mailingListUnsubscribePageKind,
  shouldUnsubscribeMailingListOnPageLoad,
} from '~/lib/workspace-forms/mailing-list-unsubscribe-page';

import { MailingListPreferenceForm } from './_components/mailing-list-preference-form';
import { MailingListPublicListsForm } from './_components/mailing-list-public-lists-form';

export const metadata = {
  title: 'Email preferences',
};

export const dynamic = 'force-dynamic';

export default async function MailingListUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const { token, status } = await searchParams;
  const pageKind = mailingListUnsubscribePageKind(token);

  if (pageKind !== 'lookup' || !token) {
    const copy = mailingListUnsubscribePageCopy(
      pageKind === 'lookup' ? 'missing_token' : pageKind,
    );

    return <PreferenceShell title={copy.title} body={copy.body} />;
  }

  let errorKind: 'invalid' | 'failed' | null = null;
  let email: string | null = null;
  let workspaceName = 'this workspace';
  let subscribed = false;
  let canResubscribe = false;
  let publicLists: Awaited<ReturnType<typeof loadMailingListPublicLists>> = [];

  try {
    const admin = getSupabaseServerAdminClient();
    let result = await lookupMailingListPublicPreference(admin, token);

    if (!result) {
      errorKind = 'invalid';
    } else {
      publicLists = await loadMailingListPublicLists(
        admin,
        result.accountId,
        result.email,
      );

      if (
        shouldUnsubscribeMailingListOnPageLoad({
          publicListCount: publicLists.length,
          status,
        })
      ) {
        result = await unsubscribeMailingListPublicPreference(admin, token);
        if (!result) {
          errorKind = 'invalid';
        } else {
          publicLists = await loadMailingListPublicLists(
            admin,
            result.accountId,
            result.email,
          );
        }
      }
    }

    if (result && !errorKind) {
      email = result.email;
      subscribed = result.marketingStatus === 'subscribed';
      canResubscribe = result.marketingStatus !== 'suppressed';
      workspaceName = await loadWorkspaceNameForPreference(
        admin,
        result.accountId,
      );
    }
  } catch {
    errorKind = 'failed';
  }

  const success = Boolean(email && !errorKind);
  const preferenceCenter = success && publicLists.length > 0;
  const anyListSubscribed = publicLists.some((list) => list.subscribed);
  const copy = mailingListPreferencePageCopy({
    errorKind,
    email,
    workspaceName,
    subscribed,
    canResubscribe,
    preferenceCenter,
  });

  return (
    <PreferenceShell
      title={copy.title}
      body={copy.body}
      wide={preferenceCenter}
    >
      {success && token && preferenceCenter ? (
        <MailingListPublicListsForm
          token={token}
          lists={publicLists}
          canManage={canResubscribe}
          showUnsubscribeAll={
            canResubscribe && (subscribed || anyListSubscribed)
          }
        />
      ) : null}
      {success &&
      token &&
      !preferenceCenter &&
      (subscribed || canResubscribe) ? (
        <MailingListPreferenceForm token={token} subscribed={subscribed} />
      ) : null}
    </PreferenceShell>
  );
}

function PreferenceShell({
  title,
  body,
  children,
  wide,
}: {
  title: string;
  body: string;
  children?: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ozer-surface-canvas)] px-6 py-12">
      <div
        className={`w-full ${wide ? 'max-w-xl' : 'max-w-lg'} rounded-3xl bg-[var(--ozer-surface-panel)] p-8 text-center shadow-sm`}
      >
        <h1 className="text-3xl font-bold text-[var(--workspace-shell-text)]">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--workspace-shell-text-muted)]">
          {body}
        </p>
        {children}
      </div>
    </main>
  );
}
