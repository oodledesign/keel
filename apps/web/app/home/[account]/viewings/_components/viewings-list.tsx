'use client';

import { useCallback, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Calendar, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import {
  VIEWING_STATUSES,
  type ViewingStatus,
} from '~/lib/commercial/commercial-constants';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
} from '~/lib/workspace-ui';

import type { CommercialListing } from '../../listings/_lib/server/listings.service';
import type { CommercialViewing } from '../_lib/server/viewings.service';
import {
  createViewing,
  deleteViewing,
} from '../_lib/server/server-actions';

const STATUS_LABELS: Record<ViewingStatus, string> = {
  upcoming: 'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
  awaiting_feedback: 'Awaiting feedback',
};

interface ViewingsListProps {
  accountId: string;
  initialViewings: CommercialViewing[];
  listings: CommercialListing[];
}

export function ViewingsList({
  accountId,
  initialViewings,
  listings,
}: ViewingsListProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialViewings);
  const [modalOpen, setModalOpen] = useState(false);
  const [listingId, setListingId] = useState(listings[0]?.id ?? '');
  const [scheduledAt, setScheduledAt] = useState('');
  const [status, setStatus] = useState<ViewingStatus>('upcoming');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSaved = useCallback(() => router.refresh(), [router]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!listingId) {
      setError('Select a listing');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createViewing({
          accountId,
          listingId,
          scheduledAt: scheduledAt
            ? new Date(scheduledAt).toISOString()
            : null,
          status,
        });
        setModalOpen(false);
        setScheduledAt('');
        handleSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create');
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this viewing?')) return;
    startTransition(async () => {
      await deleteViewing({ viewingId: id, accountId });
      setItems((prev) => prev.filter((v) => v.id !== id));
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
            Viewings
          </h2>
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            {items.length} scheduled
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          disabled={listings.length === 0}
          className={workspaceBtnPrimaryMd}
        >
          <Plus className="h-4 w-4" />
          Add viewing
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className={workspacePanelCard}>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="mb-4 h-12 w-12 text-[var(--workspace-shell-text)]/20" />
            <p className="font-medium text-[var(--workspace-shell-text)]">
              No viewings yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[11px] uppercase tracking-wide text-[var(--workspace-shell-text)]/45">
              <tr>
                <th className="px-4 py-3 font-medium">Listing</th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Outcome
                </th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((viewing) => (
                <tr
                  key={viewing.id}
                  className="border-b border-[color:var(--workspace-shell-border)] last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-[var(--workspace-shell-text)]">
                    {viewing.listingName || 'Listing'}
                  </td>
                  <td className="px-4 py-3 text-[var(--workspace-shell-text)]/70">
                    {viewing.scheduledAt
                      ? new Date(viewing.scheduledAt).toLocaleString('en-GB', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-[var(--ozer-accent-subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-accent-text)]">
                      {STATUS_LABELS[viewing.status]}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--workspace-shell-text)]/70 md:table-cell">
                    {viewing.outcome || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-rose-400"
                      onClick={() => handleDelete(viewing.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <DialogHeader>
            <DialogTitle>Add viewing</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Listing</Label>
              <Select value={listingId} onValueChange={setListingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select listing" />
                </SelectTrigger>
                <SelectContent>
                  {listings.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Scheduled at</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as ViewingStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIEWING_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error ? (
              <p className="text-sm text-rose-600">{error}</p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className={workspaceBtnPrimaryMd}>
                {isPending ? 'Saving…' : 'Add viewing'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
