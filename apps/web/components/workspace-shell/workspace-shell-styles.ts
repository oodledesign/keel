/** Shared Tailwind classes for Keel workspace shell (sidebar + top bar). */

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
  '[&_[data-sidebar=menu-button][data-active=true]]:from-[#0B132B]',
  '[&_[data-sidebar=menu-button][data-active=true]]:to-[#2A9D8F]',
  '[&_[data-sidebar=menu-button][data-active=true]]:text-white',
  '[&_[data-sidebar=menu-sub-button][data-active=true]]:bg-gradient-to-r',
  '[&_[data-sidebar=menu-sub-button][data-active=true]]:from-[#0B132B]',
  '[&_[data-sidebar=menu-sub-button][data-active=true]]:to-[#2A9D8F]',
].join(' ');

export const workspacePageCanvasClassName =
  'bg-[var(--workspace-shell-canvas)] text-white min-h-0 flex-1';
