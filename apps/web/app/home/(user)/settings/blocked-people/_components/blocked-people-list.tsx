'use client';

import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { unblockChatUserAction } from '~/home/[account]/messages/_lib/server/server-actions';
import type { BlockedChatUser } from '~/lib/messages/message-safety-shared';

export function BlockedPeopleList({
  initialPeople,
}: {
  initialPeople: BlockedChatUser[];
}) {
  const [people, setPeople] = useState(initialPeople);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function unblock(person: BlockedChatUser) {
    setPendingId(person.user_id);
    startTransition(async () => {
      const result = await unblockChatUserAction({ userId: person.user_id });
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPeople((current) =>
        current.filter((row) => row.user_id !== person.user_id),
      );
      toast.success(`Unblocked ${person.display_name}`);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]">
      <div>
        <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
          Blocked people
        </h2>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          You don&apos;t see messages from blocked people or get notifications
          from them, on the web, iPhone, iPad or Mac. They aren&apos;t told.
        </p>
      </div>

      {people.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-6 text-center text-sm text-[var(--workspace-shell-text-muted)]">
          No one blocked. To block someone, open the menu on one of their
          messages or the conversation menu in Messages.
        </p>
      ) : (
        <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-xl border border-[color:var(--workspace-shell-border)]">
          {people.map((person) => (
            <li
              key={person.user_id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <p className="min-w-0 truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                {person.display_name}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pendingId !== null}
                onClick={() => unblock(person)}
              >
                {pendingId === person.user_id ? 'Unblocking…' : 'Unblock'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
