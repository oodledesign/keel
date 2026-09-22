export const PUBLISHING_SETTINGS_TABS = [
  { id: 'website', label: 'Website', hash: 'website' },
  { id: 'portals', label: 'Portals', hash: 'portals' },
  { id: 'boards', label: 'Boards', hash: 'board-company' },
  { id: 'sync', label: 'Sync', hash: 'sync' },
] as const;

export type PublishingSettingsTab =
  (typeof PUBLISHING_SETTINGS_TABS)[number]['id'];

const TAB_IDS = new Set<string>(PUBLISHING_SETTINGS_TABS.map((tab) => tab.id));

/** Hash and query values that open the Boards tab, including the board-company deep link. */
const BOARDS_ALIASES = new Set(['boards', 'board-company']);

export function parsePublishingSettingsTab(
  value: string | null | undefined,
): PublishingSettingsTab | null {
  if (!value) return null;

  const key = value.trim().replace(/^#/, '').toLowerCase();
  if (!key) return null;
  if (BOARDS_ALIASES.has(key)) return 'boards';
  if (TAB_IDS.has(key)) return key as PublishingSettingsTab;
  return null;
}

export function publishingSettingsTabHash(tab: PublishingSettingsTab): string {
  return PUBLISHING_SETTINGS_TABS.find((item) => item.id === tab)?.hash ?? tab;
}

/** Relative URL that keeps the tab deep-linkable via query and hash. */
export function publishingSettingsTabHref(tab: PublishingSettingsTab): string {
  return `?tab=${tab}#${publishingSettingsTabHash(tab)}`;
}
