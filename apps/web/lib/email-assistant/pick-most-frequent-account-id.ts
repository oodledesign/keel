/** Pick the most common non-null account id (used for soft workspace affinity). */
export function pickMostFrequentAccountId(
  accountIds: Array<string | null | undefined>,
): string | null {
  const counts = new Map<string, number>();

  for (const accountId of accountIds) {
    if (!accountId) continue;
    counts.set(accountId, (counts.get(accountId) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;

  for (const [accountId, count] of counts) {
    if (count > bestCount) {
      best = accountId;
      bestCount = count;
    }
  }

  return best;
}
