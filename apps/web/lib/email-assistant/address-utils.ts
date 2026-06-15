export function extractEmailAddress(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  const bracketMatch = value.match(/<([^>]+@[^>]+)>/);
  if (bracketMatch?.[1]) {
    return bracketMatch[1].trim().toLowerCase();
  }

  const plain = value.trim().toLowerCase();
  return plain.includes('@') ? plain : null;
}

export function isFromOwner(
  fromAddress: string | null | undefined,
  ownerEmail: string,
): boolean {
  const from = extractEmailAddress(fromAddress);
  const owner = extractEmailAddress(ownerEmail);

  if (!from || !owner) {
    return false;
  }

  return from === owner;
}
