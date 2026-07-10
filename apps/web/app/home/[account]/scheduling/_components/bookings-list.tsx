'use client';

import { useState, useTransition } from 'react';

import { ExternalLink } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import {
  workspaceBtnPrimaryMd,
  workspacePanelBorder,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { cancelBookingAction } from '../_lib/server/scheduling-actions';
import type { BookingListRow } from '../_lib/server/scheduling.service';

type Props = {
  accountId: string;
  accountSlug: string;
  canEdit: boolean;
  upcoming: BookingListRow[];
  past: BookingListRow[];
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: string) {
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'rescheduled') return 'Rescheduled';
  return 'Confirmed';
}

export function BookingsList({
  accountId,
  accountSlug,
  canEdit,
  upcoming: initialUpcoming,
  past: initialPast,
}: Props) {
  const [upcoming, setUpcoming] = useState(initialUpcoming);
  const [past, setPast] = useState(initialPast);
  const [pending, startTransition] = useTransition();
  const [cancelTarget, setCancelTarget] = useState<BookingListRow | null>(null);
  const [reason, setReason] = useState('');

  function confirmCancel() {
    if (!cancelTarget) return;
    startTransition(async () => {
      try {
        await cancelBookingAction({
          accountId,
          accountSlug,
          bookingId: cancelTarget.id,
          cancellationReason: reason || null,
        });
        const cancelled = {
          ...cancelTarget,
          status: 'cancelled',
          cancellationReason: reason || null,
        };
        setUpcoming((current) =>
          current.filter((item) => item.id !== cancelTarget.id),
        );
        setPast((current) => [cancelled, ...current]);
        setCancelTarget(null);
        setReason('');
        toast.success('Booking cancelled');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not cancel booking',
        );
      }
    });
  }

  return (
    <div className="space-y-8">
      <BookingSection
        title="Upcoming"
        empty="No upcoming bookings."
        rows={upcoming}
        canEdit={canEdit}
        pending={pending}
        onCancel={setCancelTarget}
      />
      <BookingSection
        title="Past"
        empty="No past bookings yet."
        rows={past}
        canEdit={false}
        pending={pending}
        onCancel={setCancelTarget}
      />

      <Dialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null);
            setReason('');
          }
        }}
      >
        <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <DialogHeader>
            <DialogTitle>Cancel booking</DialogTitle>
          </DialogHeader>
          <p className={`text-sm ${workspaceTextMuted}`}>
            Cancel the meeting with {cancelTarget?.inviteeName}? The invitee will
            be notified if cancellation emails are enabled.
          </p>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelTarget(null)}
            >
              Keep booking
            </Button>
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={pending}
              onClick={confirmCancel}
            >
              Cancel booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookingSection({
  title,
  empty,
  rows,
  canEdit,
  pending,
  onCancel,
}: {
  title: string;
  empty: string;
  rows: BookingListRow[];
  canEdit: boolean;
  pending: boolean;
  onCancel: (row: BookingListRow) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <div
          className={`rounded-2xl border border-dashed p-8 text-sm ${workspacePanelBorder} ${workspaceTextMuted}`}
        >
          {empty}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${workspacePanelBorder}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{row.inviteeName}</p>
                  <Badge variant="outline" className="rounded-full">
                    {statusLabel(row.status)}
                  </Badge>
                  {row.needsHostAttention ? (
                    <Badge variant="destructive" className="rounded-full">
                      Needs attention
                    </Badge>
                  ) : null}
                </div>
                <p className={`text-sm ${workspaceTextMuted}`}>
                  {row.inviteeEmail}
                  {row.eventTypeName ? ` · ${row.eventTypeName}` : ''}
                </p>
                {row.needsHostAttention && row.hostAttentionReason ? (
                  <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
                    {row.hostAttentionReason}
                  </p>
                ) : null}
                <p className="mt-1 text-sm">{formatWhen(row.startAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {row.conferencingUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    asChild
                  >
                    <a
                      href={row.conferencingUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      Join
                    </a>
                  </Button>
                ) : null}
                {canEdit && row.status === 'confirmed' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={pending}
                    onClick={() => onCancel(row)}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
