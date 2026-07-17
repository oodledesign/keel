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
    <div className="flex items-center justify-between gap-4 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/50 p-3">
      <div>
        <p className="font-medium text-[var(--workspace-shell-text)]">
          {label}
        </p>
        {description && (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {description}
          </p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
