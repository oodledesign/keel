'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Calendar, Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import { Checkbox } from '@kit/ui/checkbox';
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
  INTEREST_STATUSES,
  INTEREST_STATUS_LABELS,
  type InterestStatus,
  REQUIREMENT_STATUSES,
  REQUIREMENT_STATUS_LABELS,
  type RequirementStatus,
  VIEWING_OUTCOMES,
  VIEWING_OUTCOME_LABELS,
  VIEWING_STATUSES,
  type ViewingOutcome,
  type ViewingStatus,
} from '~/lib/commercial/commercial-constants';
import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import {
  ClientContactPicker,
  type ClientContactPickerValue,
  emptyClientContactPickerValue,
} from '../../clients/_components/client-contact-picker';
import type { CommercialListing } from '../../listings/_lib/server/listings.service';
import {
  type ViewingRequirementOption,
  applyViewingFeedbackFollowUp,
  createViewing,
  deleteViewing,
  listViewingRequirementOptions,
  updateViewing,
} from '../_lib/server/server-actions';
import type { CommercialViewing } from '../_lib/server/viewings.service';

const STATUS_LABELS: Record<ViewingStatus, string> = {
  upcoming: 'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
  awaiting_feedback: 'Awaiting feedback',
};

const NONE_OUTCOME = '__none__';
const NONE_REQUIREMENT = '__none__';
const NONE_STAGE = '__none__';
const FOLLOW_UP_STATUSES: InterestStatus[] = ['viewed', 'withdrawn', 'lost'];

function outcomeLabel(value: string | null) {
  if (!value) return '—';
  if (value in VIEWING_OUTCOME_LABELS) {
    return VIEWING_OUTCOME_LABELS[value as ViewingOutcome];
  }
  return value;
}

function isoToDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function shouldOfferFeedbackFollowUp(input: {
  previous: CommercialViewing | null;
  saved: CommercialViewing;
}): boolean {
  const { previous, saved } = input;
  if (saved.status !== 'completed') return false;
  if (!saved.requirementId) return false;

  const outcome = saved.outcome;
  if (outcome === 'negative' || outcome === 'neutral') return true;

  if (
    previous?.status === 'awaiting_feedback' &&
    Boolean(saved.feedback?.trim())
  ) {
    return true;
  }

  return false;
}

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
  const [editing, setEditing] = useState<CommercialViewing | null>(null);
  const [listingId, setListingId] = useState(listings[0]?.id ?? '');
  const [requirementId, setRequirementId] = useState('');
  const [requirementOptions, setRequirementOptions] = useState<
    ViewingRequirementOption[]
  >([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [status, setStatus] = useState<ViewingStatus>('upcoming');
  const [outcome, setOutcome] = useState('');
  const [feedback, setFeedback] = useState('');
  const [party, setParty] = useState<ClientContactPickerValue>(
    emptyClientContactPickerValue(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpViewing, setFollowUpViewing] =
    useState<CommercialViewing | null>(null);
  const [followUpMatchId, setFollowUpMatchId] = useState<string | null>(null);
  const [followUpInterestStatus, setFollowUpInterestStatus] =
    useState<InterestStatus>('viewed');
  const [followUpAppendNotes, setFollowUpAppendNotes] = useState(true);
  const [followUpStage, setFollowUpStage] = useState<string>(NONE_STAGE);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const outcomeSelectValue = VIEWING_OUTCOMES.includes(
    outcome as ViewingOutcome,
  )
    ? outcome
    : NONE_OUTCOME;

  const handleSaved = useCallback(() => router.refresh(), [router]);

  const resetForm = () => {
    setEditing(null);
    setScheduledAt('');
    setStatus('upcoming');
    setOutcome('');
    setFeedback('');
    setParty(emptyClientContactPickerValue());
    setListingId(listings[0]?.id ?? '');
    setRequirementId('');
    setRequirementOptions([]);
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (viewing: CommercialViewing) => {
    setEditing(viewing);
    setListingId(viewing.listingId);
    setRequirementId(viewing.requirementId ?? '');
    setScheduledAt(
      viewing.scheduledAt ? isoToDatetimeLocal(viewing.scheduledAt) : '',
    );
    setStatus(viewing.status);
    setOutcome(viewing.outcome ?? '');
    setFeedback(viewing.feedback ?? '');
    setParty({
      clientId: viewing.clientId ?? '',
      contactId: viewing.contactId ?? '',
      companyName: viewing.clientName ?? '',
      contactName: viewing.contactName ?? '',
      contactEmail: '',
      contactPhone: '',
    });
    setError(null);
    setModalOpen(true);
  };

  // Load linked requirements when listing changes; prefill from client match.
  useEffect(() => {
    if (!modalOpen || !listingId) {
      setRequirementOptions([]);
      return;
    }

    let cancelled = false;
    void listViewingRequirementOptions({ accountId, listingId }).then(
      (options) => {
        if (cancelled) return;
        setRequirementOptions(options);

        setRequirementId((current) => {
          if (current && options.some((o) => o.requirementId === current)) {
            return current;
          }
          if (editing?.requirementId) {
            const existing = options.find(
              (o) => o.requirementId === editing.requirementId,
            );
            if (existing) return existing.requirementId;
          }
          if (party.clientId) {
            const forClient = options.find(
              (o) => o.clientId === party.clientId,
            );
            if (forClient) return forClient.requirementId;
          }
          return current || '';
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [modalOpen, listingId, accountId, editing?.requirementId, party.clientId]);

  // When client changes, prefer matching linked requirement.
  useEffect(() => {
    if (!modalOpen || !party.clientId || requirementOptions.length === 0) {
      return;
    }
    const forClient = requirementOptions.find(
      (o) => o.clientId === party.clientId,
    );
    if (forClient) {
      setRequirementId(forClient.requirementId);
    }
  }, [party.clientId, requirementOptions, modalOpen]);

  const openFollowUp = (saved: CommercialViewing) => {
    const option = requirementOptions.find(
      (o) => o.requirementId === saved.requirementId,
    );
    setFollowUpViewing(saved);
    setFollowUpMatchId(option?.matchId ?? null);
    const suggested: InterestStatus =
      saved.outcome === 'negative' ? 'lost' : 'viewed';
    setFollowUpInterestStatus(
      FOLLOW_UP_STATUSES.includes(suggested) ? suggested : 'viewed',
    );
    setFollowUpAppendNotes(Boolean(saved.feedback?.trim()));
    setFollowUpStage(NONE_STAGE);
    setFollowUpError(null);
    setFollowUpOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!listingId) {
      setError('Select a listing');
      return;
    }
    setError(null);
    const fields = {
      accountId,
      listingId,
      requirementId: requirementId || null,
      clientId: party.clientId || null,
      contactId: party.contactId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      status,
      outcome: outcome.trim() || null,
      feedback: feedback.trim() || null,
    };
    const previous = editing;
    startTransition(async () => {
      try {
        let saved: CommercialViewing;
        if (editing) {
          saved = await updateViewing({
            viewingId: editing.id,
            ...fields,
          });
          setItems((prev) => prev.map((v) => (v.id === saved.id ? saved : v)));
        } else {
          saved = await createViewing(fields);
        }
        setModalOpen(false);
        resetForm();
        handleSaved();

        if (shouldOfferFeedbackFollowUp({ previous, saved })) {
          openFollowUp(saved);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    });
  };

  const handleFollowUpSubmit = () => {
    if (!followUpViewing?.requirementId) return;
    setFollowUpError(null);
    startTransition(async () => {
      try {
        await applyViewingFeedbackFollowUp({
          accountId,
          viewingId: followUpViewing.id,
          listingId: followUpViewing.listingId,
          requirementId: followUpViewing.requirementId!,
          matchId: followUpMatchId,
          interestStatus: followUpInterestStatus,
          appendFeedbackToNotes: followUpAppendNotes,
          requirementStage:
            followUpStage === NONE_STAGE
              ? null
              : (followUpStage as RequirementStatus),
          feedbackText: followUpViewing.feedback,
        });
        setFollowUpOpen(false);
        setFollowUpViewing(null);
        handleSaved();
      } catch (err) {
        setFollowUpError(
          err instanceof Error ? err.message : 'Failed to apply follow-up',
        );
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
      <div className="flex items-center justify-end">
        <Button
          onClick={openCreate}
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
            <thead className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[11px] tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Listing</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Contact
                </th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">
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
                  <td className="hidden px-4 py-3 text-[var(--workspace-shell-text)]/70 md:table-cell">
                    {viewing.clientName || viewing.contactName ? (
                      <div>
                        <div>{viewing.clientName || viewing.contactName}</div>
                        {viewing.clientName && viewing.contactName ? (
                          <div className="text-xs text-[var(--workspace-shell-text)]/45">
                            {viewing.contactName}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      '—'
                    )}
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
                  <td className="hidden px-4 py-3 text-[var(--workspace-shell-text)]/70 lg:table-cell">
                    {outcomeLabel(viewing.outcome)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[var(--workspace-shell-text)]/60"
                        onClick={() => openEdit(viewing)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-rose-400"
                        onClick={() => handleDelete(viewing.id)}
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
            <DialogTitle>
              {editing ? 'Edit viewing' : 'Add viewing'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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

            <ClientContactPicker
              accountId={accountId}
              active={modalOpen}
              value={party}
              onChange={setParty}
              onError={setError}
              showSummary
              allowNone
              terminology="commercial"
            />

            <div className="space-y-1.5">
              <Label>Linked requirement</Label>
              <Select
                value={requirementId || NONE_REQUIREMENT}
                onValueChange={(v) =>
                  setRequirementId(v === NONE_REQUIREMENT ? '' : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select from Interest" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_REQUIREMENT}>Not linked</SelectItem>
                  {requirementOptions.map((opt) => (
                    <SelectItem
                      key={opt.requirementId}
                      value={opt.requirementId}
                    >
                      {opt.label} (
                      {INTEREST_STATUS_LABELS[
                        opt.interestStatus as InterestStatus
                      ] ?? opt.interestStatus}
                      )
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {requirementOptions.length === 0 ? (
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  No Interest matches on this listing yet. Link a requirement
                  after adding Interest, or leave blank.
                </p>
              ) : null}
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
            <div className="space-y-1.5">
              <Label>Outcome</Label>
              <Select
                value={outcomeSelectValue}
                onValueChange={(v) => setOutcome(v === NONE_OUTCOME ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select feedback sentiment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_OUTCOME}>Not set</SelectItem>
                  {VIEWING_OUTCOMES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {VIEWING_OUTCOME_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Feedback notes</Label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Notes from the viewing"
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
                {isPending
                  ? 'Saving…'
                  : editing
                    ? 'Save changes'
                    : 'Add viewing'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={followUpOpen}
        onOpenChange={(open) => {
          setFollowUpOpen(open);
          if (!open) setFollowUpViewing(null);
        }}
      >
        <DialogContent className="max-w-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <DialogHeader>
            <DialogTitle>Update requirement from feedback?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Apply this viewing outcome to the linked Interest and brief.
            </p>

            <div className="space-y-1.5">
              <Label>Interest status</Label>
              <Select
                value={followUpInterestStatus}
                onValueChange={(v) =>
                  setFollowUpInterestStatus(v as InterestStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTEREST_STATUSES.filter(
                    (s) =>
                      FOLLOW_UP_STATUSES.includes(s) ||
                      s === followUpInterestStatus,
                  ).map((s) => (
                    <SelectItem key={s} value={s}>
                      {INTEREST_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={followUpAppendNotes}
                onCheckedChange={(v) => setFollowUpAppendNotes(v === true)}
                className="mt-0.5"
              />
              <span>
                Append feedback to requirement notes
                {followUpViewing?.feedback ? (
                  <span className="mt-1 block text-xs text-[var(--workspace-shell-text-muted)]">
                    “{followUpViewing.feedback.slice(0, 120)}
                    {followUpViewing.feedback.length > 120 ? '…' : ''}”
                  </span>
                ) : null}
              </span>
            </label>

            <div className="space-y-1.5">
              <Label>Requirement stage (optional)</Label>
              <Select value={followUpStage} onValueChange={setFollowUpStage}>
                <SelectTrigger>
                  <SelectValue placeholder="Keep current stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_STAGE}>Keep current</SelectItem>
                  {REQUIREMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {REQUIREMENT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {followUpError ? (
              <p className="text-sm text-rose-600">{followUpError}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setFollowUpOpen(false)}
              >
                Skip
              </Button>
              <Button
                type="button"
                disabled={isPending}
                className={workspaceBtnPrimaryMd}
                onClick={handleFollowUpSubmit}
              >
                {isPending ? 'Applying…' : 'Apply updates'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
