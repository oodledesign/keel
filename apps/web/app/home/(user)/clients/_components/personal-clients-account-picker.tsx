'use client';

import { useRouter } from 'next/navigation';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

export function PersonalClientsAccountPicker({
  accounts,
  currentSlug,
}: {
  accounts: Array<{ label: string; value: string }>;
  currentSlug: string;
}) {
  const router = useRouter();

  if (accounts.length <= 1) {
    const only = accounts[0];
    if (!only) return null;
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        <span className="text-[var(--workspace-shell-text-muted)]">
          Workspace
        </span>{' '}
        <span className="font-medium text-[var(--workspace-shell-text)]">
          {only.label}
        </span>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
        Workspace
      </span>
      <Select
        value={currentSlug}
        onValueChange={(value) => {
          router.push(`/app/clients?account=${encodeURIComponent(value)}`, {
            scroll: false,
          });
        }}
      >
        <SelectTrigger className="w-full border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] sm:w-[min(100%,280px)]">
          <SelectValue placeholder="Select workspace" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((a) => (
            <SelectItem key={a.value} value={a.value}>
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
