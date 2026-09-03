'use client';

import { useCallback, useEffect, useState } from 'react';

import { Clock, History } from 'lucide-react';

import { getErrorMessage } from '../_lib/error-message';
import { listContractEvents } from '../_lib/server/server-actions';

type ContractEventRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  actor_id: string | null;
  created_at: string;
};

const EVENT_LABELS: Record<string, string> = {
  created: 'Contract created',
  updated: 'Draft updated',
  sent: 'Sent to recipient',
  author_signed: 'Signed by author',
  recipient_signed: 'Signed by recipient',
  signed: 'Fully signed',
  status_changed: 'Status changed',
  invoices_generated: 'Instalment invoices generated',
  email_delivery_failed: 'Email delivery failed',
  signed_notification_failed: '"Signed" notification failed to send',
  link_revoked: 'Shareable link revoked',
  portal_viewed: 'Viewed via shareable link',
  pdf_downloaded: 'PDF downloaded via shareable link',
  archived: 'Archived',
  restored: 'Restored',
  duplicated: 'Duplicated from another contract',
  recipient_declined: 'Recipient declined',
  reminder_sent: 'Reminder sent',
  email_resent: 'Email resent',
  link_expiry_updated: 'Shareable link expiry updated',
  version_created: 'New version created',
  version_sent: 'Version sent',
  version_superseded: 'Previous version superseded',
  signers_updated: 'Signing roster updated',
};

function eventLabel(eventType: string): string {
  return (
    EVENT_LABELS[eventType] ??
    eventType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function eventDetail(row: ContractEventRow): string | null {
  const payload = row.payload ?? {};
  switch (row.event_type) {
    case 'sent':
      return typeof payload.sent_to_email === 'string'
        ? `to ${payload.sent_to_email}`
        : null;
    case 'status_changed':
      return typeof payload.old_status === 'string' &&
        typeof payload.new_status === 'string'
        ? `${payload.old_status} → ${payload.new_status}`
        : null;
    case 'email_delivery_failed':
    case 'signed_notification_failed':
      return typeof payload.error === 'string' ? payload.error : null;
    case 'invoices_generated':
      return typeof payload.count === 'number'
        ? `${payload.count} invoice${payload.count === 1 ? '' : 's'}`
        : null;
    case 'recipient_declined':
      return typeof payload.reason === 'string' && payload.reason
        ? payload.reason
        : null;
    case 'reminder_sent':
    case 'email_resent':
      return typeof payload.recipient === 'string'
        ? `to ${payload.recipient}`
        : null;
    case 'link_expiry_updated':
      return typeof payload.expires_at === 'string'
        ? `until ${new Date(payload.expires_at).toLocaleDateString('en-GB')}`
        : 'no expiry';
    case 'version_created':
    case 'version_sent':
    case 'version_superseded':
      return typeof payload.version_number === 'number'
        ? `v${payload.version_number}`
        : null;
    default:
      return null;
  }
}

export function ContractActivityTimeline({
  accountId,
  contractId,
}: {
  accountId: string;
  contractId: string;
}) {
  const [events, setEvents] = useState<ContractEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listContractEvents({ accountId, contractId });
      setEvents((result ?? []) as unknown as ContractEventRow[]);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [accountId, contractId]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  return (
    <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 md:p-6">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
        <h3 className="font-medium text-[var(--workspace-shell-text)]">
          Activity
        </h3>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Loading activity…
        </p>
      ) : error ? (
        <p className="text-sm text-amber-300">{error}</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No activity recorded yet.
        </p>
      ) : (
        <ol className="space-y-3">
          {events.map((event) => {
            const detail = eventDetail(event);
            return (
              <li key={event.id} className="flex gap-3 text-sm">
                <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--workspace-shell-text-muted)]" />
                <div>
                  <p className="text-[var(--workspace-shell-text)]">
                    {eventLabel(event.event_type)}
                  </p>
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    {formatDateTime(event.created_at)}
                    {detail ? ` · ${detail}` : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
