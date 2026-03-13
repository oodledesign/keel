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
          ? 'border-emerald-500 bg-zinc-800/80 text-white ring-1 ring-emerald-500/30'
          : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600'
      }`}
    >
      <span className="font-medium">{title}</span>
      {selected && <Check className="h-5 w-5 shrink-0 text-emerald-500" />}
    </button>
  );
}
