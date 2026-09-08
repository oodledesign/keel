/** Newest instruction updates first (expanded ladder + activity list). */
export function sortWipNotesNewestFirst<
  T extends { id: string; createdAt: string },
>(notes: T[]): T[] {
  return [...notes].sort((a, b) => {
    const byDate = b.createdAt.localeCompare(a.createdAt);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });
}
