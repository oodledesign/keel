/**
 * Ozer-only signature profile overrides.
 * Directory columns (full_name, job_title, department) stay the live
 * Microsoft/Google values. A non-empty override wins at render time;
 * null/blank means use the directory value.
 */

export const SIGNATURE_PROFILE_OVERRIDE_FIELDS = [
  'full_name',
  'job_title',
  'department',
] as const;

export type SignatureProfileOverrideField =
  (typeof SIGNATURE_PROFILE_OVERRIDE_FIELDS)[number];

export type SignatureProfileOverrideColumns = {
  full_name_override?: string | null;
  job_title_override?: string | null;
  department_override?: string | null;
};

export type SignatureDirectoryProfile = {
  full_name: string | null;
  job_title: string | null;
  department: string | null;
};

export type SignatureProfileWithOverrides = SignatureDirectoryProfile &
  SignatureProfileOverrideColumns;

export function normalizeSignatureOverride(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveSignatureProfileField(
  directoryValue: string | null | undefined,
  override: string | null | undefined,
): string | null {
  return (
    normalizeSignatureOverride(override) ??
    normalizeSignatureOverride(directoryValue)
  );
}

export function applySignatureProfileOverrides<
  T extends SignatureProfileWithOverrides,
>(staff: T): T {
  return {
    ...staff,
    full_name: resolveSignatureProfileField(
      staff.full_name,
      staff.full_name_override,
    ),
    job_title: resolveSignatureProfileField(
      staff.job_title,
      staff.job_title_override,
    ),
    department: resolveSignatureProfileField(
      staff.department,
      staff.department_override,
    ),
  };
}

/**
 * Persist an override only when it differs from the live directory value.
 * Empty or matching values store null so the next Graph/Google sync flows through.
 */
export function signatureOverrideToStore(
  directoryValue: string | null | undefined,
  submitted: string | null | undefined,
): string | null {
  const next = normalizeSignatureOverride(submitted);
  const directory = normalizeSignatureOverride(directoryValue);
  if (!next || next === directory) {
    return null;
  }
  return next;
}

export function staffProfileOverridePatch(input: {
  existing: SignatureDirectoryProfile;
  submitted: SignatureDirectoryProfile;
  clear?: Partial<Record<SignatureProfileOverrideField, boolean>>;
}): Required<SignatureProfileOverrideColumns> {
  return {
    full_name_override: input.clear?.full_name
      ? null
      : signatureOverrideToStore(
          input.existing.full_name,
          input.submitted.full_name,
        ),
    job_title_override: input.clear?.job_title
      ? null
      : signatureOverrideToStore(
          input.existing.job_title,
          input.submitted.job_title,
        ),
    department_override: input.clear?.department
      ? null
      : signatureOverrideToStore(
          input.existing.department,
          input.submitted.department,
        ),
  };
}

export function isSignatureProfileFieldOverridden(
  _directoryValue: string | null | undefined,
  override: string | null | undefined,
): boolean {
  return normalizeSignatureOverride(override) != null;
}

/** Directory-synced staff only; manual/CSV callers never show this control. */
export function directoryResetLabel(source: string | null | undefined): string {
  if (source === 'google') {
    return 'Reset to Google';
  }
  return 'Reset to Microsoft';
}

export function directoryValueHint(source: string | null | undefined): string {
  if (source === 'google') {
    return 'Google Workspace';
  }
  return 'Microsoft 365';
}
