'use client';

import { WorkspaceSwitcher } from './workspace-switcher';

/**
 * Compact wrapper so the workspace picker sits cleanly at the top of the
 * Nextra sidebar (rendered via a `_meta` separator).
 */
export function WorkspaceSidebarHeader() {
  return (
    <div className="ozer-workspace-sidebar-header">
      <WorkspaceSwitcher />
    </div>
  );
}
