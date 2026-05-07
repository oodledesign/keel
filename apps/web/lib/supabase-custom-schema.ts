/**
 * PostgREST exposes module schemas; generated `Database` types may lag, so `.schema()`
 * is typed too narrowly on the default client.
 */
export function supabaseCustomSchema(
  client: unknown,
  schema: 'rankly' | 'feedflow' | 'signatures',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).schema(schema);
}
