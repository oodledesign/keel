/**
 * Placeholder for future Gmail → suggested tasks ingestion.
 *
 * Planned flow (not implemented):
 * 1. OAuth to Google Workspace / Gmail with read-only or metadata scope.
 * 2. Webhook or scheduled job fetches new threads for connected users.
 * 3. Same Anthropic extraction pipeline produces draft rows stored in a
 *    `task_suggestions` table (or reuses the extract review UI).
 * 4. In-app notifications route users to `/work/[account]/tasks/extract` (or a
 *    dedicated inbox) to approve or discard.
 *
 * Environment placeholders (document in deployment secrets when built):
 * - `TASK_GMAIL_INGEST_ENABLED` — `"true"` when the worker is active (default off).
 * - `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` — Gmail API credentials.
 * - `TASK_GMAIL_WEBHOOK_SECRET` — verify Pub/Sub or push payloads.
 */
export const TASK_GMAIL_INGEST_PLACEHOLDER = true;

export function isGmailTaskIngestConfigured(): boolean {
  return process.env.TASK_GMAIL_INGEST_ENABLED === 'true';
}
