export type AccountModuleKey =
  | 'jobs'
  | 'schedule'
  | 'clients'
  | 'invoices'
  | 'team'
  | 'pipeline';

export type AccountModuleSettingsMap = Partial<Record<AccountModuleKey, boolean>>;

export type WorkspaceSpaceType = 'work' | 'family' | 'community';

export function normalizeSpaceType(
  raw: string | null | undefined,
): WorkspaceSpaceType {
  if (raw === 'family') return 'family';
  if (raw === 'community') return 'community';
  return 'work';
}

export function getSpaceTypeFromAccount(account: {
  space_type?: string | null;
}): WorkspaceSpaceType {
  return normalizeSpaceType(account.space_type);
}

/** Per-account module toggles (`account_module_settings.module_key`). */
export function isAccountModuleEnabled(
  moduleSettings: Record<string, boolean> | null | undefined,
  key: string,
) {
  if (!moduleSettings) {
    return true;
  }

  return moduleSettings[key] ?? true;
}

export function isWorkModuleEnabled(
  moduleSettings: Record<string, boolean> | null | undefined,
  key: AccountModuleKey,
) {
  return isAccountModuleEnabled(moduleSettings, key);
}
