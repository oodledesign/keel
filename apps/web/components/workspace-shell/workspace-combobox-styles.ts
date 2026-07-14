/** Popover shell for cmdk comboboxes — scroll lives on CommandList. */
export const workspaceComboboxPopoverClass =
  'flex w-[var(--radix-popover-trigger-width)] max-h-[min(var(--radix-popover-content-available-height),24rem)] flex-col overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0';

export const workspaceComboboxListClass =
  'max-h-[min(50dvh,16rem)] min-h-0 overflow-y-auto overscroll-contain touch-pan-y';

/** Search field: no focus ring / double border. */
export const workspaceComboboxInputClass =
  'h-9 border-0 bg-transparent shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]';

/** Keep item hover dark with a subtle lift — avoid white accent fill. */
export const workspaceComboboxItemClass =
  'cursor-pointer text-[var(--workspace-shell-text)] aria-selected:bg-[color-mix(in_srgb,var(--workspace-shell-text)_10%,transparent)] aria-selected:text-[var(--workspace-shell-text)] data-[selected=true]:bg-[color-mix(in_srgb,var(--workspace-shell-text)_10%,transparent)] data-[selected=true]:text-[var(--workspace-shell-text)]';
