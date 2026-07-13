/** Popover shell for cmdk comboboxes — scroll lives on CommandList. */
export const workspaceComboboxPopoverClass =
  'flex w-[var(--radix-popover-trigger-width)] max-h-[min(var(--radix-popover-content-available-height),24rem)] flex-col overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0';

export const workspaceComboboxListClass =
  'max-h-[min(50dvh,16rem)] min-h-0 overflow-y-auto overscroll-contain touch-pan-y';
