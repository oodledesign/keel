export function portalPublishFailureMessage(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;

  const row = result as { ok?: unknown; error?: unknown; message?: unknown };
  if (row.ok !== false) return null;

  if (typeof row.error === 'string' && row.error.trim()) {
    return row.error.trim();
  }
  if (typeof row.message === 'string' && row.message.trim()) {
    return row.message.trim();
  }

  return 'Publish failed';
}
