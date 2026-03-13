'use client';

import { Switch } from '@kit/ui/switch';

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
      <div>
        <p className="font-medium text-zinc-200">{label}</p>
        {description && (
          <p className="text-xs text-zinc-500">{description}</p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
