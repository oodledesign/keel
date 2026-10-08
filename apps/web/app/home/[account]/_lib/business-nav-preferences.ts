/**
 * Business sidebar link choices, stored as `account_module_settings` rows keyed
 * `nav:<navKey>` (enabled = shown). They only hide links; module and plan
 * gates still decide what a workspace can open.
 */
export const NAV_PREFERENCE_PREFIX = 'nav:';

export type BusinessNavChoice = { key: string; label: string };

export const BUSINESS_NAV_CHOICE_SECTIONS: ReadonlyArray<{
  label: string;
  choices: ReadonlyArray<BusinessNavChoice>;
}> = [
  {
    label: 'Work',
    choices: [
      { key: 'projects', label: 'Projects' },
      { key: 'tasks', label: 'Tasks' },
      { key: 'planner', label: 'Planner' },
      { key: 'schedule', label: 'Schedule' },
      { key: 'scheduling', label: 'Scheduling' },
    ],
  },
  {
    label: 'Clients',
    choices: [
      { key: 'pipeline', label: 'Pipeline' },
      { key: 'forms', label: 'Forms' },
      { key: 'clients', label: 'Clients' },
      { key: 'meetings', label: 'Meetings' },
      { key: 'activity', label: 'Activity' },
      { key: 'emails', label: 'Emails' },
      { key: 'websites', label: 'Websites' },
      { key: 'support_tickets', label: 'Support' },
    ],
  },
  {
    label: 'Commercial',
    choices: [
      { key: 'invoices', label: 'Invoices' },
      { key: 'proposals', label: 'Proposals' },
      { key: 'contracts', label: 'Contracts' },
      { key: 'retainers', label: 'Retainers' },
      { key: 'finances', label: 'Finances' },
    ],
  },
  {
    label: 'Team & tools',
    choices: [
      { key: 'team', label: 'Team' },
      { key: 'notes', label: 'Notes and files' },
      { key: 'brain', label: 'Second brain' },
      { key: 'sops', label: 'SOPs' },
      { key: 'messages', label: 'Messages' },
    ],
  },
];

export const BUSINESS_NAV_CHOICE_KEYS = BUSINESS_NAV_CHOICE_SECTIONS.flatMap(
  (section) => section.choices.map((choice) => choice.key),
);

export function navPreferenceKey(navKey: string): string {
  return `${NAV_PREFERENCE_PREFIX}${navKey}`;
}

export function isNavPreferenceKey(key: string): boolean {
  return key.startsWith(NAV_PREFERENCE_PREFIX);
}

/** Dashboard is always shown; anything without a saved choice is shown. */
export function isNavItemHidden(
  moduleSettings: Record<string, boolean> | null | undefined,
  navKey: string,
): boolean {
  if (navKey === 'dashboard') return false;
  return moduleSettings?.[navPreferenceKey(navKey)] === false;
}

/** Module settings minus sidebar choices, for lists that should keep hidden links. */
export function withoutNavPreferences(
  moduleSettings: Record<string, boolean> | undefined,
): Record<string, boolean> | undefined {
  if (!moduleSettings) return moduleSettings;
  return Object.fromEntries(
    Object.entries(moduleSettings).filter(([key]) => !isNavPreferenceKey(key)),
  );
}

/** One row per choice so a later save always overwrites earlier ones. */
export function businessNavPreferenceRows(
  accountId: string,
  visible: Record<string, boolean>,
) {
  return BUSINESS_NAV_CHOICE_KEYS.map((navKey) => ({
    account_id: accountId,
    module_key: navPreferenceKey(navKey),
    enabled: visible[navKey] ?? true,
  }));
}

export function readBusinessNavVisibility(
  moduleSettings: Record<string, boolean> | null | undefined,
): Record<string, boolean> {
  return Object.fromEntries(
    BUSINESS_NAV_CHOICE_KEYS.map((key) => [
      key,
      !isNavItemHidden(moduleSettings, key),
    ]),
  );
}
