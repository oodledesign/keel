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
      <p className="text-sm text-zinc-400">
        <span className="text-zinc-500">Workspace</span>{' '}
        <span className="font-medium text-zinc-200">{only.label}</span>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Workspace
      </span>
      <Select
        value={currentSlug}
        onValueChange={(value) => {
          router.push(
            `/app/clients?account=${encodeURIComponent(value)}`,
            { scroll: false },
          );
        }}
      >
        <SelectTrigger className="w-full border-white/10 bg-[var(--workspace-shell-panel)] sm:w-[min(100%,280px)]">
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
