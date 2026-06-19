/** Shared Tailwind classes for Ozer workspace shell (sidebar + top bar). */

export const WORKSPACE_SIDEBAR_WIDTH = '15rem'; // 240px

export const workspaceSidebarClassName = [
  'bg-[var(--workspace-shell-sidebar)] text-white',
  '[--sidebar-background:var(--workspace-shell-sidebar)]',
  '[--sidebar-foreground:#ffffff]',
  '[--sidebar-accent:rgba(255,255,255,0.06)]',
  '[--sidebar-accent-foreground:#ffffff]',
  '[--sidebar-border:rgba(255,255,255,0.08)]',
  '[--sidebar-width:15rem]',
  '[&_[data-sidebar=sidebar]]:bg-[var(--workspace-shell-sidebar)]',
  '[&_[data-sidebar=sidebar]]:text-white',
  '[&_[data-sidebar=sidebar]]:border-r',
  '[&_[data-sidebar=sidebar]]:border-white/[0.08]',
  '[&_[data-sidebar=group-label]]:hidden',
  '[&_[data-sidebar=group]+[data-sidebar=group]]:mt-2',
  '[&_[data-sidebar=menu-button]]:h-10',
  '[&_[data-sidebar=menu-button]]:rounded-lg',
  '[&_[data-sidebar=menu-button]]:px-3',
  '[&_[data-sidebar=menu-button]]:text-sm',
  '[&_[data-sidebar=menu-button]]:font-medium',
  '[&_[data-sidebar=menu-button]]:text-white/80',
  '[&_[data-sidebar=menu-button]:hover]:bg-white/[0.06]',
  '[&_[data-sidebar=menu-button]:hover]:text-white',
  '[&_[data-sidebar=menu-button][data-active=true]]:border-0',
  '[&_[data-sidebar=menu-button][data-active=true]]:bg-gradient-to-r',
  '[&_[data-sidebar=menu-button][data-active=true]]:from-[var(--keel-gradient-from)]',
  '[&_[data-sidebar=menu-button][data-active=true]]:to-[var(--keel-gradient-to)]',
  '[&_[data-sidebar=menu-button][data-active=true]]:text-white',
  '[&_[data-sidebar=menu-sub-button][data-active=true]]:bg-gradient-to-r',
  '[&_[data-sidebar=menu-sub-button][data-active=true]]:from-[var(--keel-gradient-from)]',
  '[&_[data-sidebar=menu-sub-button][data-active=true]]:to-[var(--keel-gradient-to)]',
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
