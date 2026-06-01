/** PostgREST / Postgres errors when a relation is missing on the remote project. */
export function isMissingRelationError(err: unknown): boolean {
  const e = err as { code?: string; message?: string; details?: string };
  const blob = `${e?.message ?? ''} ${e?.details ?? ''}`.toLowerCase();

  return (
    e?.code === 'PGRST205' ||
    e?.code === '42P01' ||
    blob.includes('could not find the table') ||
    blob.includes('schema cache') ||
    blob.includes('relation') && blob.includes('does not exist')
  );
}

export function logMissingRelation(context: string, err: unknown) {
  const e = err as { message?: string };
  console.warn(
    `[${context}] optional table missing — run supabase db push from apps/web:`,
    e?.message ?? err,
  );
}
