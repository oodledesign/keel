/** Shared classes for Ozer workspace UI — use CSS variables only (see DESIGN_SYSTEM.md). */

const easeOut = 'ease-[cubic-bezier(0.23,1,0.32,1)]';

export const workspaceBtnPrimary =
  'bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]';

export const workspaceBtnPress =
  `transition-transform duration-[160ms] ${easeOut} active:scale-[0.97]`;

export const workspaceBtnPrimaryMd = `inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 ${workspaceBtnPrimary} ${workspaceBtnPress}`;

export const workspaceBtnPrimaryLg = `inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 ${workspaceBtnPrimary} ${workspaceBtnPress}`;

export const workspaceLinkAccent =
  'text-[var(--workspace-shell-accent-text)] hover:text-[var(--ozer-accent)]';

export const workspaceFocusRing =
  'focus-visible:ring-[var(--ozer-accent)] focus-visible:border-[var(--ozer-accent)]/50 focus-visible:ring-[var(--ozer-accent)]/30';

export const workspaceTabActive =
  'border-[var(--ozer-accent)] text-[var(--workspace-shell-accent-text)]';

export const workspaceFilterActive =
  'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]';

export const workspaceSuccessBadge =
  'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]';

export const workspaceSuccessBadgeBorder =
  'border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]';

export const workspaceCardHover =
  'transition-[border-color,background-color] duration-200 ease-out hover:border-[var(--ozer-accent)]/30 hover:bg-[var(--workspace-shell-panel-hover)]';

export const workspaceAccentText = 'text-[var(--workspace-shell-accent-text)]';

export const workspaceSurfacePanel = 'bg-[var(--workspace-shell-panel)]';

export const workspaceSurfaceCanvas = 'bg-[var(--workspace-shell-canvas)]';

/** Semantic shell text — adapts to light/dark */
export const workspaceText = 'text-[var(--workspace-shell-text)]';

export const workspaceTextMuted = 'text-[var(--workspace-shell-text-muted)]';

export const workspaceBorder = 'border-[color:var(--workspace-shell-border)]';

export const workspaceControlSurface = 'bg-[var(--workspace-control-surface)]';

export const workspacePanelBorder =
  'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

export const workspaceSubtleFill = 'bg-[var(--workspace-shell-sidebar-accent)]';

export const workspaceOnAccentText = 'text-[var(--ozer-white)]';
