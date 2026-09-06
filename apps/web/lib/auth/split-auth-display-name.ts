export type AuthDisplayNameParts = {
  firstName: string;
  lastName: string;
};

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function splitFullName(fullName: string): AuthDisplayNameParts {
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

/**
 * Prefill company-step name fields from Auth / user_settings.
 * Google typically sets given_name + family_name or full_name.
 */
export function splitAuthDisplayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  fullName?: string | null;
  name?: string | null;
}): AuthDisplayNameParts {
  const firstName =
    asTrimmedString(input.firstName) || asTrimmedString(input.givenName);
  const lastName =
    asTrimmedString(input.lastName) || asTrimmedString(input.familyName);

  if (firstName) {
    return { firstName, lastName };
  }

  const combined =
    asTrimmedString(input.fullName) || asTrimmedString(input.name);
  if (combined) {
    return splitFullName(combined);
  }

  return { firstName: '', lastName: '' };
}
