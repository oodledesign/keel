/**
 * First-name greeting for signed-in users on the client portal invite screen.
 * Prefers auth metadata, then a full-name token, then the email local-part.
 */
export function firstNameFromSignedInUser(input: {
  userMetadata?: Record<string, unknown> | null;
  email?: string | null;
}): string | null {
  const meta = input.userMetadata ?? {};
  const candidates = [
    stringField(meta, 'first_name'),
    stringField(meta, 'given_name'),
    stringField(meta, 'full_name'),
    stringField(meta, 'display_name'),
    stringField(meta, 'name'),
    emailLocalPart(input.email),
  ];

  for (const candidate of candidates) {
    const first = toFirstName(candidate);
    if (first) {
      return first;
    }
  }

  return null;
}

export function inviteGreeting(firstName: string | null): string {
  return firstName ? `Hi ${firstName},` : 'Hi,';
}

function stringField(
  meta: Record<string, unknown>,
  key: string,
): string | null {
  const value = meta[key];
  return typeof value === 'string' ? value : null;
}

function emailLocalPart(email?: string | null): string | null {
  if (!email) {
    return null;
  }

  return email.split('@')[0] ?? null;
}

function toFirstName(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const cleaned = raw.trim();
  if (!cleaned) {
    return null;
  }

  let token = cleaned.split(/\s+/)[0] ?? cleaned;

  if (/[._+-]/.test(token)) {
    token = token.split(/[._+-]/)[0] ?? token;
  }

  if (!token) {
    return null;
  }

  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}
