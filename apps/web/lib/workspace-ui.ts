/** Shared classes for Ozer workspace UI — use CSS variables only (see DESIGN_SYSTEM.md). */

export const workspaceBtnPrimary =
  'bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]';

export const workspaceBtnPrimaryMd = `inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 ${workspaceBtnPrimary}`;

export const workspaceBtnPrimaryLg = `inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 ${workspaceBtnPrimary}`;

export const workspaceLinkAccent =
  'text-[var(--ozer-accent-muted)] hover:text-[var(--ozer-accent)]';

export const workspaceFocusRing = 'focus-visible:ring-[var(--ozer-accent)]';

export const workspaceTabActive =
  'border-[var(--ozer-accent)] text-[var(--ozer-accent-muted)]';

export const workspaceSuccessBadge =
  'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]';

export const workspaceSuccessBadgeBorder =
  'border-[var(--ozer-accent)]/40 bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]';
