/** Shared Tailwind classes for Ozer workspace shell (sidebar + top bar). */

export const WORKSPACE_SIDEBAR_WIDTH = '15rem'; // 240px

export const workspaceSidebarClassName = [
  'bg-[var(--workspace-shell-sidebar)] text-[var(--workspace-shell-text-on-dark)]',
  '[--sidebar-background:var(--workspace-shell-sidebar)]',
  '[--sidebar-foreground:var(--workspace-shell-text-on-dark)]',
  '[--sidebar-accent:var(--workspace-shell-sidebar-accent)]',
  '[--sidebar-accent-foreground:var(--workspace-shell-text-on-dark)]',
  '[--sidebar-border:var(--workspace-shell-border)]',
  '[--sidebar-width:15rem]',
  '[&_[data-sidebar=sidebar]]:bg-[var(--workspace-shell-sidebar)]',
  '[&_[data-sidebar=sidebar]]:text-[var(--workspace-shell-text-on-dark)]',
  '[&_[data-sidebar=sidebar]]:border-r',
  '[&_[data-sidebar=sidebar]]:border-[var(--workspace-shell-border)]',
  '[&_[data-sidebar=group-label]]:hidden',
  '[&_[data-sidebar=group]+[data-sidebar=group]]:mt-2',
  '[&_[data-sidebar=menu-button]]:h-10',
  '[&_[data-sidebar=menu-button]]:rounded-lg',
  '[&_[data-sidebar=menu-button]]:px-3',
  '[&_[data-sidebar=menu-button]]:text-sm',
  '[&_[data-sidebar=menu-button]]:font-medium',
  '[&_[data-sidebar=menu-button]]:text-[var(--workspace-shell-text-on-dark-muted)]',
  '[&_[data-sidebar=menu-button]:hover]:bg-[var(--workspace-shell-sidebar-accent)]',
  '[&_[data-sidebar=menu-button]:hover]:text-[var(--workspace-shell-text-on-dark)]',
  '[&_[data-sidebar=menu-button][data-active=true]]:border-0',
  '[&_[data-sidebar=menu-button][data-active=true]]:bg-gradient-to-r',
  '[&_[data-sidebar=menu-button][data-active=true]]:from-[var(--ozer-gradient-active-from)]',
  '[&_[data-sidebar=menu-button][data-active=true]]:to-[var(--ozer-gradient-active-to)]',
  '[&_[data-sidebar=menu-button][data-active=true]]:text-[var(--ozer-white)]',
  '[&_[data-sidebar=menu-sub-button][data-active=true]]:bg-gradient-to-r',
  '[&_[data-sidebar=menu-sub-button][data-active=true]]:from-[var(--ozer-gradient-active-from)]',
  '[&_[data-sidebar=menu-sub-button][data-active=true]]:to-[var(--ozer-gradient-active-to)]',
].join(' ');

export const workspacePageCanvasClassName =
  'bg-[var(--workspace-shell-canvas)] text-[var(--workspace-shell-text)] min-h-0 flex-1';

/** Page body: full-bleed on mobile, inset from lg. */
export const workspacePageBodyClassName =
  'bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6';

/** Inner content column when the page body is full-bleed on mobile. */
export const workspacePageContentClassName = 'px-4 lg:px-0';

/** Full-width main column for workspace dashboard and module pages. */
export const workspacePageMainClassName =
  'flex w-full min-w-0 flex-1 flex-col gap-6 px-3 pb-8 pt-3 md:px-6 md:pb-12 md:pt-6 lg:px-8';

/** Dashboard home rhythm (business / personal overview pages). */
export const workspaceDashboardMainClassName =
  'flex w-full min-w-0 flex-col gap-4 px-3 pb-8 pt-3 md:px-6 lg:px-8 lg:pb-10 lg:pt-5';
