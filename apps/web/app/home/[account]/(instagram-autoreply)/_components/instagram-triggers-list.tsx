'use client';

import Link from 'next/link';
import { useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Switch } from '@kit/ui/switch';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';

type TriggerRow = {
  id: string;
  name: string;
  keywords: string[];
  is_active: boolean;
};

type InstagramTriggersListProps = {
  accountSlug: string;
  accountId: string;
  triggers: TriggerRow[];
  onToggle: (input: {
    accountId: string;
    triggerId: string;
    is_active: boolean;
  }) => Promise<{ ok: boolean }>;
  onDelete: (input: {
    accountId: string;
    triggerId: string;
  }) => Promise<{ ok: boolean }>;
};

export function InstagramTriggersList({
  accountSlug,
  accountId,
  triggers,
  onToggle,
  onDelete,
}: InstagramTriggersListProps) {
  const [pending, startTransition] = useTransition();
  const newHref = pathsConfig.app.accountInstagramAutoreplyTriggerDetail
    .replace('[account]', accountSlug)
    .replace('[triggerId]', 'new');

  return (
    <div className="mx-4 space-y-4 lg:mx-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Triggers</h2>
        <Button asChild size="sm">
          <Link href={newHref}>New trigger</Link>
        </Button>
      </div>

      {triggers.length === 0 ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No triggers yet. Create one to start auto-replying to comments.
        </p>
      ) : (
        <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-lg border border-[color:var(--workspace-shell-border)]">
          {triggers.map((trigger) => {
            const editHref = pathsConfig.app.accountInstagramAutoreplyTriggerDetail
              .replace('[account]', accountSlug)
              .replace('[triggerId]', trigger.id);

            return (
              <li
                key={trigger.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <Link href={editHref} className="font-medium hover:underline">
                    {trigger.name}
                  </Link>
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    {trigger.keywords.join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={trigger.is_active}
                    disabled={pending}
                    onCheckedChange={(checked) =>
                      startTransition(async () => {
                        try {
                          await onToggle({
                            accountId,
                            triggerId: trigger.id,
                            is_active: checked,
                          });
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : 'Update failed',
                          );
                        }
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          await onDelete({
                            accountId,
                            triggerId: trigger.id,
                          });
                          toast.success('Trigger deleted');
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : 'Delete failed',
                          );
                        }
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
