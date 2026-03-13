'use client';

import { useEffect, useState } from 'react';

import { Trash2, UserPlus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';

import {
  createJobEvent,
  getJobEvent,
  listAccountMembers,
  listJobEventAssignments,
  setJobEventAssignments,
  updateJobEvent,
} from '../_lib/server/server-actions';
import { getErrorMessage } from '../_lib/error-message';

import { ClientCombobox } from './client-combobox';

type JobEventFormProps = {
  accountSlug: string;
  accountId: string;
  jobId: string;
  eventId: string | null;
  isCreate: boolean;
  canEditJobs: boolean;
  onSuccess: () => void;
  onDelete?: () => void;
};

export function JobEventForm({
  accountSlug,
  accountId,
  jobId,
  eventId,
  isCreate,
  canEditJobs,
  onSuccess,
  onDelete,
}: JobEventFormProps) {
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<'site_visit' | 'meeting'>('site_visit');
  const [scheduledStartAt, setScheduledStartAt] = useState('');
  const [scheduledEndAt, setScheduledEndAt] = useState('');
  const [location, setLocation] = useState('');
  const [prepNotes, setPrepNotes] = useState('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpAt, setFollowUpAt] = useState('');
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState<{ id: string; display_name: string | null }[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [assignments, setAssignments] = useState<{ user_id: string; role_on_event: string | null }[]>([]);
  const [members, setMembers] = useState<{ user_id: string; name: string | null; email: string | null }[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [assignRole, setAssignRole] = useState('');

  useEffect(() => {
    if (!eventId || isCreate) return;
    getJobEvent({ accountId, eventId })
      .then((event: Record<string, unknown>) => {
        setTitle((event.title as string) ?? '');
        setEventType((event.event_type as 'site_visit' | 'meeting') ?? 'site_visit');
        setScheduledStartAt(
          event.scheduled_start_at
            ? new Date(event.scheduled_start_at as string).toISOString().slice(0, 16)
            : ''
        );
        setScheduledEndAt(
          event.scheduled_end_at
            ? new Date(event.scheduled_end_at as string).toISOString().slice(0, 16)
            : ''
        );
        setLocation((event.location as string) ?? '');
        setPrepNotes((event.prep_notes as string) ?? '');
        setOutcomeNotes((event.outcome_notes as string) ?? '');
        setFollowUpRequired(!!event.follow_up_required);
        setFollowUpAt(
          event.follow_up_at
            ? new Date(event.follow_up_at as string).toISOString().slice(0, 16)
            : ''
        );
        setClientId((event.client_id as string) ?? '');
      })
      .catch(() => toast.error('Failed to load event'));
  }, [eventId, isCreate, accountId]);

  useEffect(() => {
    if (!eventId) return;
    listJobEventAssignments({ accountId, eventId })
      .then((raw: unknown) => {
        const list = Array.isArray(raw) ? raw : [];
        setAssignments(list as { user_id: string; role_on_event: string | null }[]);
      })
      .catch(() => setAssignments([]));
  }, [accountId, eventId]);

  useEffect(() => {
    if (!accountSlug) return;
    listAccountMembers({ accountSlug })
      .then((raw: unknown) => {
        const list = Array.isArray(raw) ? raw : [];
        setMembers(list as { user_id: string; name: string | null; email: string | null }[]);
      })
      .catch(() => setMembers([]));
  }, [accountSlug]);

  useEffect(() => {
    if (!accountId) return;
    setClientsLoading(true);
    listClients({ accountId, page: 1, pageSize: 100 })
      .then((r: unknown) => {
        const raw = r as { data?: unknown } | unknown[];
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: unknown })?.data)
            ? (raw as { data: unknown[] }).data
            : [];
        setClients((list || []) as { id: string; display_name: string | null }[]);
      })
      .catch(() => setClients([]))
      .finally(() => setClientsLoading(false));
  }, [accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!scheduledStartAt) {
      toast.error('Start date/time is required');
      return;
    }
    setSubmitting(true);
    try {
      if (isCreate) {
        await createJobEvent({
          accountId,
          jobId,
          client_id: clientId.trim() || null,
          title: title.trim(),
          event_type: eventType,
          scheduled_start_at: new Date(scheduledStartAt),
          scheduled_end_at: scheduledEndAt ? new Date(scheduledEndAt) : undefined,
          location: location.trim() || undefined,
          prep_notes: prepNotes.trim() || undefined,
          follow_up_required: followUpRequired,
          follow_up_at: followUpAt ? new Date(followUpAt) : undefined,
        });
        toast.success('Visit/meeting created');
      } else if (eventId) {
        await updateJobEvent({
          accountId,
          eventId,
          client_id: clientId.trim() || null,
          title: title.trim(),
          event_type: eventType,
          scheduled_start_at: new Date(scheduledStartAt),
          scheduled_end_at: scheduledEndAt ? new Date(scheduledEndAt) : null,
          location: location.trim() || null,
          prep_notes: prepNotes.trim() || null,
          outcome_notes: outcomeNotes.trim() || null,
          follow_up_required: followUpRequired,
          follow_up_at: followUpAt ? new Date(followUpAt) : null,
        });
        await setJobEventAssignments({
          accountId,
          eventId,
          assignments: assignments.map((a) => ({
            userId: a.user_id,
            role_on_event: a.role_on_event ?? undefined,
          })),
        });
        toast.success('Visit/meeting updated');
      }
      onSuccess();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAssignment = () => {
    if (!selectedMemberId) return;
    if (assignments.some((a) => a.user_id === selectedMemberId)) return;
    setAssignments((prev) => [
      ...prev,
      { user_id: selectedMemberId, role_on_event: assignRole.trim() || null },
    ]);
    setSelectedMemberId('');
    setAssignRole('');
  };

  const handleRemoveAssignment = (userId: string) => {
    setAssignments((prev) => prev.filter((a) => a.user_id !== userId));
  };

  const assignedUserIds = new Set(assignments.map((a) => a.user_id));
  const membersNotAssigned = members.filter((m) => !assignedUserIds.has(m.user_id));

  const canEditAll = canEditJobs;
  /* Contractor can edit only prep_notes and outcome_notes; Save still shown for notes-only updates */

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label className="text-zinc-300">Title *</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 border-zinc-600 bg-zinc-800 text-white"
          placeholder="e.g. Initial site visit"
          disabled={!canEditAll}
        />
      </div>
      <div>
        <Label className="text-zinc-300">Type</Label>
        <Select
          value={eventType}
          onValueChange={(v) => setEventType(v as 'site_visit' | 'meeting')}
          disabled={!canEditAll}
        >
          <SelectTrigger className="mt-1 border-zinc-600 bg-zinc-800 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="site_visit">Site visit</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-zinc-300">Client</Label>
        <div className="mt-1">
          <ClientCombobox
            clients={clients.map((c) => ({ id: c.id, display_name: c.display_name }))}
            value={clientId}
            onValueChange={setClientId}
            loading={clientsLoading}
            disabled={!canEditAll}
            placeholder="Select client (optional)"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-zinc-300">Start *</Label>
          <Input
            type="datetime-local"
            value={scheduledStartAt}
            onChange={(e) => setScheduledStartAt(e.target.value)}
            className="mt-1 border-zinc-600 bg-zinc-800 text-white"
            disabled={!canEditAll}
          />
        </div>
        <div>
          <Label className="text-zinc-300">End</Label>
          <Input
            type="datetime-local"
            value={scheduledEndAt}
            onChange={(e) => setScheduledEndAt(e.target.value)}
            className="mt-1 border-zinc-600 bg-zinc-800 text-white"
            disabled={!canEditAll}
          />
        </div>
      </div>
      <div>
        <Label className="text-zinc-300">Location</Label>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="mt-1 border-zinc-600 bg-zinc-800 text-white"
          placeholder="Address or place"
          disabled={!canEditAll}
        />
      </div>
      <div>
        <Label className="text-zinc-300">Prep notes</Label>
        <textarea
          value={prepNotes}
          onChange={(e) => setPrepNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500"
          placeholder="Notes before the visit/meeting"
        />
      </div>
      {!isCreate && (
        <div>
          <Label className="text-zinc-300">Outcome notes</Label>
          <textarea
            value={outcomeNotes}
            onChange={(e) => setOutcomeNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500"
            placeholder="Notes after the visit/meeting"
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="follow_up"
          checked={followUpRequired}
          onChange={(e) => {
            const checked = e.target.checked;
            setFollowUpRequired(checked);
            if (checked) {
              const base = scheduledEndAt || scheduledStartAt;
              const d = base ? new Date(base) : new Date();
              d.setDate(d.getDate() + 7);
              setFollowUpAt(d.toISOString().slice(0, 16));
            } else {
              setFollowUpAt('');
            }
          }}
          disabled={!canEditAll}
          className="rounded border-zinc-600 bg-zinc-800"
        />
        <Label htmlFor="follow_up" className="text-zinc-300">
          Follow-up required
        </Label>
      </div>
      {followUpRequired && (
        <div>
          <Label className="text-zinc-300">Follow-up by</Label>
          <Input
            type="datetime-local"
            value={followUpAt}
            onChange={(e) => setFollowUpAt(e.target.value)}
            className="mt-1 border-zinc-600 bg-zinc-800 text-white"
            disabled={!canEditAll}
          />
        </div>
      )}

      {!isCreate && eventId && canEditAll && (
        <div className="border-t border-zinc-700 pt-4">
          <Label className="text-zinc-300">Assigned team</Label>
          <ul className="mt-2 space-y-1.5 text-sm text-zinc-300">
            {assignments.map((a) => {
              const m = members.find((x) => x.user_id === a.user_id);
              const label = m ? m.name || m.email || a.user_id.slice(0, 8) : a.user_id.slice(0, 8);
              return (
                <li
                  key={a.user_id}
                  className="flex items-center justify-between rounded-md border border-zinc-700 bg-[var(--workspace-shell-panel)] px-3 py-2"
                >
                  <span>{a.role_on_event ? `${a.role_on_event}: ` : ''}{label}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-zinc-400 hover:text-red-400"
                    onClick={() => handleRemoveAssignment(a.user_id)}
                  >
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Select
              value={selectedMemberId || 'none'}
              onValueChange={(v) => setSelectedMemberId(v === 'none' ? '' : v)}
              disabled={membersNotAssigned.length === 0}
            >
              <SelectTrigger className="min-w-[160px] border-zinc-600 bg-zinc-800 text-white">
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select…</SelectItem>
                {membersNotAssigned.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.name || m.email || m.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Role (optional)"
              value={assignRole}
              onChange={(e) => setAssignRole(e.target.value)}
              className="h-9 w-28 border-zinc-600 bg-zinc-800 text-white"
            />
            <Button
              type="button"
              size="sm"
              className={selectedMemberId ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400'}
              disabled={!selectedMemberId}
              onClick={handleAddAssignment}
            >
              <UserPlus className="mr-1 h-4 w-4" />
              Assign
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-700 pt-4">
        <Button
          type="submit"
          disabled={submitting}
          className="bg-emerald-600 hover:bg-emerald-500"
        >
          {submitting ? 'Saving…' : isCreate ? 'Create' : 'Save'}
        </Button>
        {!isCreate && onDelete && canEditAll && (
          <Button
            type="button"
            variant="outline"
            className="border-red-900/50 text-red-400 hover:bg-red-950/50"
            disabled={deleting}
            onClick={() => onDelete()}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        )}
      </div>
    </form>
  );
}
