'use client';

import { cn } from '@kit/ui/utils';

import {
  PUBLISHING_SETTINGS_TABS,
  type PublishingSettingsTab,
  publishingSettingsTabHref,
} from '~/lib/commercial/publishing-settings-tabs';

export function CommercialPublishingSectionNav({
  tab,
  onSelect,
}: {
  tab: PublishingSettingsTab;
  onSelect: (tab: PublishingSettingsTab) => void;
}) {
  return (
    <nav
      aria-label="Website and portals"
      className="w-full shrink-0 lg:sticky lg:top-6 lg:w-52"
    >
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {PUBLISHING_SETTINGS_TABS.map((item) => {
          const active = item.id === tab;

          return (
            <li key={item.id} className="shrink-0">
              <a
                href={publishingSettingsTabHref(item.id)}
                data-test={`publishing-tab-${item.id}`}
                className={cn(
                  'flex items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                    : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
                )}
                aria-current={active ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onSelect(item.id);
                }}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
