'use client';

import { useState, useTransition } from 'react';

import { Switch } from '@kit/ui/switch';

import type { PublicAudienceListPreference } from '~/lib/workspace-forms/mailing-list-public-preference';

import {
  setMailingListPublicListAction,
  unsubscribeMailingListAction,
} from '../_lib/server/server-actions';
import { MailingListPreferenceSubmit } from './mailing-list-preference-submit';

export function MailingListPublicListsForm({
  token,
  lists,
  canManage,
  showUnsubscribeAll,
}: {
  token: string;
  lists: PublicAudienceListPreference[];
  canManage: boolean;
  showUnsubscribeAll: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-8 space-y-4 text-left">
      {error ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          {error}
        </p>
      ) : null}
      <ul className="space-y-3">
        {lists.map((list) => (
          <li
            key={list.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--workspace-shell-border)] px-4 py-3"
          >
            <span className="text-sm font-medium text-[var(--workspace-shell-text)]">
              {list.name}
            </span>
            <Switch
              checked={list.subscribed}
              disabled={!canManage || pending}
              onCheckedChange={(next) => {
                startTransition(async () => {
                  setError(null);
                  try {
                    await setMailingListPublicListAction({
                      token,
                      listId: list.id,
                      subscribed: next,
                    });
                  } catch {
                    setError(
                      'We could not update your email preference. Please try again.',
                    );
                  }
                });
              }}
              aria-label={
                list.subscribed
                  ? `Unsubscribe from ${list.name}`
                  : `Subscribe to ${list.name}`
              }
              data-test={`mailing-list-public-${list.id}`}
            />
          </li>
        ))}
      </ul>
      {showUnsubscribeAll ? (
        <form action={unsubscribeMailingListAction} className="text-center">
          <input type="hidden" name="token" value={token} />
          <MailingListPreferenceSubmit
            variant="quiet"
            label="Unsubscribe from all"
            pendingLabel="Unsubscribing…"
          />
        </form>
      ) : null}
    </div>
  );
}
