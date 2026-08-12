/**
 * Build planner task notes from an extracted suggestion description
 * plus an optional verbatim source excerpt (email/meeting).
 */
export function buildTaskNotesFromSource(input: {
  description?: string | null;
  sourceExcerpt?: string | null;
  sourceLabel?: 'Meeting' | 'Email';
}): string | null {
  const description = input.description?.trim() || null;
  const excerpt = input.sourceExcerpt?.trim() || null;
  const label = input.sourceLabel ?? 'Source';

  const parts: string[] = [];

  if (description) {
    parts.push(description);
  }

  if (excerpt && excerpt !== description) {
    parts.push(`${label} excerpt: "${excerpt}"`);
  }

  return parts.length > 0 ? parts.join('\n\n') : null;
}
