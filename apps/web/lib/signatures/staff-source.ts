export const STAFF_SOURCES = ['microsoft', 'google', 'manual', 'csv'] as const;

export type StaffSource = (typeof STAFF_SOURCES)[number];

export type StaffSyncConflict = {
  email: string;
  existingSource: StaffSource;
  message: string;
};

export type StaffSyncResult = {
  synced: number;
  errors: string[];
  conflicts: StaffSyncConflict[];
};

export function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isManualStaffSource(
  source: string | null | undefined,
): source is 'manual' | 'csv' {
  return source === 'manual' || source === 'csv';
}

export function isSyncedStaffSource(
  source: string | null | undefined,
): source is 'microsoft' | 'google' {
  return source === 'microsoft' || source === 'google';
}

export function staffSourceLabel(source: StaffSource): string {
  switch (source) {
    case 'microsoft':
      return 'Microsoft 365';
    case 'google':
      return 'Google Workspace';
    case 'manual':
      return 'Manual';
    case 'csv':
      return 'CSV import';
    default:
      return source;
  }
}
