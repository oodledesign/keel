/**
 * Merge server-fetched message pages with existing client state by id,
 * then sort by created_at (stable tie-break on id).
 */
export function mergeChatMessagesById<
  T extends { id: string; created_at: string },
>(existing: T[], next: T[]): T[] {
  if (existing.length === 0) return next;
  const byId = new Map<string, T>();
  for (const msg of existing) byId.set(msg.id, msg);
  for (const msg of next) byId.set(msg.id, msg);
  return Array.from(byId.values()).sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}
