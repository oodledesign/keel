/**
 * Hosted Supabase must list `signatures` under Project Settings → API → Exposed schemas
 * or PostgREST returns 406 / "Invalid schema: signatures".
 */
export function isSignaturesPostgrestSchemaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const blob = msg.toLowerCase();
  return (
    (msg.includes('Invalid schema') &&
      (msg.includes('signatures') || msg.includes('"signatures"'))) ||
    (blob.includes('signatures') &&
      (blob.includes('could not find the table') ||
        blob.includes('schema cache')))
  );
}
