export function uniqueEmails(
  ...groups: Array<string | string[] | null | undefined>
): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];

  for (const group of groups) {
    const values = Array.isArray(group) ? group : [group];
    for (const value of values) {
      const email = value?.trim();
      if (!email) continue;
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      emails.push(email);
    }
  }

  return emails;
}
