/** Shared classes for Keel workspace UI (see DESIGN_SYSTEM.md — teal primary). */

export const workspaceBtnPrimary =
  'bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]';

export const workspaceBtnPrimaryMd = `inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 ${workspaceBtnPrimary}`;

export const workspaceBtnPrimaryLg = `inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 ${workspaceBtnPrimary}`;

export const workspaceLinkAccent = 'text-[#5eead4] hover:text-[var(--keel-teal)]';

export const workspaceFocusRing = 'focus-visible:ring-[var(--keel-teal)]';

export const workspaceTabActive = 'border-[var(--keel-teal)] text-[#5eead4]';

export const workspaceSuccessBadge = 'bg-[var(--keel-teal)]/15 text-[#5eead4]';

export const workspaceSuccessBadgeBorder =
  'border-[var(--keel-teal)]/40 bg-[var(--keel-teal)]/10 text-[#5eead4]';
