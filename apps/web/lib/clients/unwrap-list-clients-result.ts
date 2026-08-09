/**
 * Normalize listClients / listClientsOverview-style results from server actions.
 * Never silently treat an unexpected shape as an empty client list.
 */
export type UnwrappedListClientsResult<T> =
  | { ok: true; data: T[] }
  | { ok: false; error: string };

export function unwrapListClientsResult<T = unknown>(
  result: unknown,
): UnwrappedListClientsResult<T> {
  if (Array.isArray(result)) {
    return { ok: true, data: result as T[] };
  }

  if (result && typeof result === 'object' && 'data' in result) {
    const data = (result as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return { ok: true, data: data as T[] };
    }
  }

  return {
    ok: false,
    error: 'Could not load clients',
  };
}
