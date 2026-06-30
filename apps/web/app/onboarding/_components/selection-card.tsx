'use client';

import { Check } from 'lucide-react';

interface SelectionCardProps {
  title: string;
  selected: boolean;
  onSelect: () => void;
}

export function SelectionCard({
  title,
  selected,
  onSelect,
}: SelectionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center justify-between rounded-lg border p-4 text-left transition ${
        selected
          ? 'border-[var(--ozer-accent)] bg-[var(--workspace-control-surface)]/80 text-[var(--workspace-shell-text)] ring-1 ring-[var(--ozer-accent)]/30'
          : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/50 text-[var(--workspace-shell-text-muted)] hover:border-[color:var(--workspace-shell-border)]'
      }`}
    >
      <span className="font-medium">{title}</span>
      {selected && <Check className="h-5 w-5 shrink-0 text-[var(--ozer-accent)]" />}
    </button>
  );
}
