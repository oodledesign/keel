/** PostgREST errors when a column is missing on the remote project. */
export function isMissingColumnError(err: unknown): boolean {
  const e = err as { code?: string; message?: string; details?: string };
  const blob = `${e?.message ?? ''} ${e?.details ?? ''}`.toLowerCase();

  return (
    e?.code === 'PGRST204' ||
    e?.code === '42703' ||
    /could not find the .* column/i.test(blob) ||
    (blob.includes('column') && blob.includes('does not exist'))
  );
}

/** PostgREST PGRST201 — multiple FKs between two tables (e.g. projects ↔ clients). */
export function isAmbiguousEmbedError(err: unknown): boolean {
  const e = err as { code?: string; message?: string; details?: string };
  const blob = `${e?.message ?? ''} ${e?.details ?? ''}`.toLowerCase();

  return (
    e?.code === 'PGRST201' ||
    blob.includes('more than one relationship was found')
  );
}

export function isRecoverableProjectsClientsEmbedError(err: unknown): boolean {
  return isMissingColumnError(err) || isAmbiguousEmbedError(err);
}

/** PostgREST / Postgres errors when a relation is missing on the remote project. */
export function isMissingRelationError(err: unknown): boolean {
  const e = err as { code?: string; message?: string; details?: string };
  const blob = `${e?.message ?? ''} ${e?.details ?? ''}`.toLowerCase();

  return (
    e?.code === 'PGRST205' ||
    e?.code === '42P01' ||
    blob.includes('could not find the table') ||
    blob.includes('schema cache') ||
    (blob.includes('relation') && blob.includes('does not exist'))
  );
}

export function logMissingRelation(context: string, err: unknown) {
  const e = err as { message?: string };
  console.warn(
    `[${context}] optional table missing — run supabase db push from apps/web:`,
    e?.message ?? err,
  );
}
