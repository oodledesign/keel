'use client';

import { useState, useTransition } from 'react';

import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { saveBoardPromptPreferencesAction } from '../_lib/server/board-prompt.actions';

type BranchOption = { id: string; name: string };

export function BoardPromptSettingsCard({
  accountId,
  initialEnabled,
  initialOffBranchIds,
  branches,
  boardsSettingsHref,
}: {
  accountId: string;
  initialEnabled: boolean;
  initialOffBranchIds: string[];
  branches: BranchOption[];
  boardsSettingsHref: string;
}) {
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [offBranchIds, setOffBranchIds] = useState(initialOffBranchIds);

  function save(nextEnabled: boolean, nextOff: string[]) {
    const previous = { enabled, offBranchIds };
    setEnabled(nextEnabled);
    setOffBranchIds(nextOff);
    startTransition(async () => {
      try {
        const saved = await saveBoardPromptPreferencesAction({
          accountId,
          promptEnabled: nextEnabled,
          promptOffBranchIds: nextOff,
        });
        setEnabled(saved.promptEnabled);
        setOffBranchIds(saved.promptOffBranchIds);
        toast.success('Board prompt settings saved');
      } catch (error) {
        setEnabled(previous.enabled);
        setOffBranchIds(previous.offBranchIds);
        toast.error(
          error instanceof Error ? error.message : 'Could not save settings',
        );
      }
    });
  }

  function toggleBranch(branchId: string, on: boolean) {
    const next = on
      ? offBranchIds.filter((id) => id !== branchId)
      : [...offBranchIds, branchId];
    save(enabled, next);
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]"
      data-test="board-prompt-settings"
    >
      <div>
        <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
          Board company prompt
        </h2>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          When a disposal moves to Under offer, Let or Sold, agents are asked
          whether to email the board company. This applies to everyone in the
          workspace. The board email address and wording are in{' '}
          <a href={boardsSettingsHref} className="underline underline-offset-2">
            Website &amp; portals
          </a>
          .
        </p>
      </div>

      <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-xl border border-[color:var(--workspace-shell-border)]">
        <li className="flex items-start justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Ask to notify the board company
            </p>
            <p className="mt-0.5 text-sm text-[var(--workspace-shell-text-muted)]">
              Turn off to stop the prompt appearing on status changes.
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={pending}
            onCheckedChange={(on) => save(on, offBranchIds)}
            aria-label="Ask to notify the board company"
            data-test="board-prompt-master-switch"
          />
        </li>

        {branches.length > 1
          ? branches.map((branch) => (
              <li
                key={branch.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <p className="text-sm text-[var(--workspace-shell-text)]">
                  {branch.name}
                </p>
                <Switch
                  checked={enabled && !offBranchIds.includes(branch.id)}
                  disabled={pending || !enabled}
                  onCheckedChange={(on) => toggleBranch(branch.id, on)}
                  aria-label={`Ask to notify the board company for ${branch.name}`}
                />
              </li>
            ))
          : null}
      </ul>
    </div>
  );
}
