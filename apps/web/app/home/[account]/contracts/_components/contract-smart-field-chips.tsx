'use client';

import { CONTRACT_SMART_FIELDS } from '~/lib/contracts/smart-fields';

export function ContractSmartFieldChips({
  onInsert,
  disabled,
}: {
  onInsert: (token: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <span className="mr-1 self-center text-xs text-[var(--workspace-shell-text-muted)]">
        Smart fields
      </span>
      {CONTRACT_SMART_FIELDS.map((field) => (
        <button
          key={field.token}
          type="button"
          disabled={disabled}
          title={`Insert ${field.token}`}
          onClick={() => onInsert(field.token)}
          className="rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-2 py-0.5 text-[11px] text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--workspace-shell-text)] disabled:opacity-50"
        >
          {field.label}
        </button>
      ))}
    </div>
  );
}
