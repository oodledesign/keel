export type CanvasCommentLike = {
  id: string;
  itemId: string;
  authorId: string;
  resolvedAt: string | null;
  createdAt: string;
};

/** One thread per canvas item; the oldest comment carries the resolved state. */
export type CanvasCommentThread<T extends CanvasCommentLike> = {
  itemId: string;
  comments: T[];
  root: T;
  resolved: boolean;
  lastAt: string;
};

export function groupCanvasComments<T extends CanvasCommentLike>(
  comments: T[],
): CanvasCommentThread<T>[] {
  const byItem = new Map<string, T[]>();
  for (const comment of comments) {
    byItem.set(comment.itemId, [
      ...(byItem.get(comment.itemId) ?? []),
      comment,
    ]);
  }
  return [...byItem]
    .map(([itemId, list]) => {
      const sorted = [...list].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );
      const root = sorted[0]!;
      return {
        itemId,
        comments: sorted,
        root,
        resolved: Boolean(root.resolvedAt),
        lastAt: sorted[sorted.length - 1]!.createdAt,
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** The "@word" being typed just before the caret, if any. */
export function mentionQueryAt(
  text: string,
  caret: number,
): { query: string; start: number } | null {
  const match = /(^|\s)@([^\s@]{0,30})$/.exec(text.slice(0, caret));
  if (!match) return null;
  return { query: match[2] ?? '', start: caret - (match[2]?.length ?? 0) - 1 };
}

/** Mentioned people whose "@Name" is still in the text. */
export function activeMentionIds(
  body: string,
  picked: Array<{ id: string; name: string }>,
): string[] {
  const ids = new Set<string>();
  for (const person of picked) {
    if (!person.name) continue;
    const name = person.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`@${name}(?![\\p{L}\\p{N}])`, 'u').test(body)) {
      ids.add(person.id);
    }
  }
  return [...ids];
}
