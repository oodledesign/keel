'use client';

import { useCallback, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';

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
import { Textarea } from '@kit/ui/textarea';

import {
  LEASE_STATUSES,
  type LeaseStatus,
} from '~/lib/commercial/commercial-constants';
import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import type { CommercialListing } from '../../listings/_lib/server/listings.service';
import type { CommercialLease } from '../_lib/server/leases.service';
import {
  createLease,
  deleteLease,
  updateLease,
} from '../_lib/server/server-actions';

const STATUS_LABELS: Record<LeaseStatus, string> = {
  active: 'Active',
  expired: 'Expired',
  terminated: 'Terminated',
};

const NONE_LISTING = '__none__';

function isoToDateInput(iso: string | null) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

interface LeasesListProps {
  accountId: string;
  initialLeases: CommercialLease[];
  listings: CommercialListing[];
}

export function LeasesList({
  accountId,
  initialLeases,
  listings,
}: LeasesListProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialLeases);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CommercialLease | null>(null);
  const [listingId, setListingId] = useState(NONE_LISTING);
  const [propertyLabel, setPropertyLabel] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [town, setTown] = useState('');
  const [postcode, setPostcode] = useState('');
  const [headlineRentPsf, setHeadlineRentPsf] = useState('');
  const [leaseStart, setLeaseStart] = useState('');
  const [leaseEnd, setLeaseEnd] = useState('');
  const [status, setStatus] = useState<LeaseStatus>('active');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSaved = useCallback(() => router.refresh(), [router]);

  const resetForm = () => {
    setEditing(null);
    setListingId(NONE_LISTING);
    setPropertyLabel('');
    setTenantName('');
    setTown('');
    setPostcode('');
    setHeadlineRentPsf('');
    setLeaseStart('');
    setLeaseEnd('');
    setStatus('active');
    setNotes('');
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (lease: CommercialLease) => {
    setEditing(lease);
    setListingId(lease.listingId ?? NONE_LISTING);
    setPropertyLabel(lease.propertyLabel);
    setTenantName(lease.tenantName ?? '');
    setTown(lease.town ?? '');
    setPostcode(lease.postcode ?? '');
    setHeadlineRentPsf(
      lease.headlineRentPsf != null ? String(lease.headlineRentPsf) : '',
    );
    setLeaseStart(isoToDateInput(lease.leaseStart));
    setLeaseEnd(isoToDateInput(lease.leaseEnd));
    setStatus(lease.status);
    setNotes(lease.notes ?? '');
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyLabel.trim()) {
      setError('Property label is required');
      return;
    }
    setError(null);
    const fields = {
      accountId,
      listingId: listingId === NONE_LISTING ? null : listingId,
      propertyLabel: propertyLabel.trim(),
      tenantName: tenantName.trim() || null,
      town: town.trim() || null,
      postcode: postcode.trim() || null,
      headlineRentPsf: headlineRentPsf ? Number(headlineRentPsf) : null,
      leaseStart: leaseStart || null,
      leaseEnd: leaseEnd || null,
      status,
      notes: notes.trim() || null,
    };
    startTransition(async () => {
      try {
        if (editing) {
          const updated = await updateLease({
            leaseId: editing.id,
            ...fields,
          });
          setItems((prev) =>
            prev.map((l) => (l.id === updated.id ? updated : l)),
          );
        } else {
          await createLease(fields);
        }
        setModalOpen(false);
        resetForm();
        handleSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this lease?')) return;
    startTransition(async () => {
      await deleteLease({ leaseId: id, accountId });
      setItems((prev) => prev.filter((l) => l.id !== id));
    });
  };

  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleDateString('en-GB', { dateStyle: 'medium' })
      : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
            Sales register
          </h2>
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            {items.length} recorded
          </p>
        </div>
        <Button onClick={openCreate} className={workspaceBtnPrimaryMd}>
          <Plus className="h-4 w-4" />
          Add lease
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className={workspacePanelCard}>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-4 h-12 w-12 text-[var(--workspace-shell-text)]/20" />
            <p className="font-medium text-[var(--workspace-shell-text)]">
              No leases yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[11px] tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Property</th>
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Term
                </th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">
                  Rent PSF
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((lease) => (
                <tr
                  key={lease.id}
                  className="border-b border-[color:var(--workspace-shell-border)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--workspace-shell-text)]">
                      {lease.propertyLabel}
                    </p>
                    {lease.listingName ? (
                      <p className="text-xs text-[var(--workspace-shell-text)]/50">
                        {lease.listingName}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[var(--workspace-shell-text)]/70">
                    {lease.tenantName || '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--workspace-shell-text)]/70 md:table-cell">
                    {formatDate(lease.leaseStart)} –{' '}
                    {formatDate(lease.leaseEnd)}
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--workspace-shell-text)]/70 lg:table-cell">
                    {lease.headlineRentPsf != null
                      ? `£${lease.headlineRentPsf.toLocaleString('en-GB')}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-[var(--ozer-accent-subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-accent-text)]">
                      {STATUS_LABELS[lease.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[var(--workspace-shell-text)]/60"
                        onClick={() => openEdit(lease)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-rose-400"
                        onClick={() => handleDelete(lease.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit lease' : 'Add lease'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Property label</Label>
              <Input
                value={propertyLabel}
                onChange={(e) => setPropertyLabel(e.target.value)}
                placeholder="e.g. Unit 3, Riverside Business Park"
                required
              />
            </div>
            {listings.length > 0 ? (
              <div className="space-y-1.5">
                <Label>Linked listing (optional)</Label>
                <Select value={listingId} onValueChange={setListingId}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_LISTING}>None</SelectItem>
                    {listings.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Tenant name</Label>
              <Input
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Town</Label>
                <Input value={town} onChange={(e) => setTown(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Postcode</Label>
                <Input
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Headline rent PSF (£)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={headlineRentPsf}
                onChange={(e) => setHeadlineRentPsf(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Lease start</Label>
                <Input
                  type="date"
                  value={leaseStart}
                  onChange={(e) => setLeaseStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Lease end</Label>
                <Input
                  type="date"
                  value={leaseEnd}
                  onChange={(e) => setLeaseEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as LeaseStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEASE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional lease notes"
                rows={3}
              />
            </div>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className={workspaceBtnPrimaryMd}
              >
                {isPending ? 'Saving…' : editing ? 'Save changes' : 'Add lease'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
