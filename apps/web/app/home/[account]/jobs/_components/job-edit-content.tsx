'use client';

import { useEffect, useState } from 'react';

import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@kit/ui/alert-dialog';
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

import pathsConfig from '~/config/paths.config';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';

import { ClientCombobox } from './client-combobox';
import { getErrorMessage } from '../_lib/error-message';
import {
  addJobAssignment,
  deleteJob,
  listAccountMembers,
  listJobAssignments,
  removeJobAssignment,
  updateJob,
} from '../_lib/server/server-actions';

type Job = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  value_pence: number | null;
  client_id: string | null;
  [key: string]: unknown;
};

export function JobEditContent({
  accountSlug,
  accountId,
  jobId,
  job,
  canEditJobs,
  canDeleteJobs,
}: {
  accountSlug: string;
  accountId: string;
  jobId: string;
  job: Job;
  canViewJobs: boolean;
  canEditJobs: boolean;
  canDeleteJobs: boolean;
}) {
  const router = useRouter();
  const jobsPath = pathsConfig.app.accountJobs.replace('[account]', accountSlug);
  const detailPath = pathsConfig.app.accountJobDetail.replace('[account]', accountSlug).replace('[id]', jobId);

  const [title, setTitle] = useState(job.title);
  const [clientId, setClientId] = useState<string>(job.client_id ?? '');
  const [description, setDescription] = useState(job.description ?? '');
  const [status, setStatus] = useState(job.status);
  const [priority, setPriority] = useState(job.priority);
  const [dueDate, setDueDate] = useState(
    job.due_date ? new Date(job.due_date).toISOString().slice(0, 10) : ''
  );
  const [valuePence, setValuePence] = useState(
    job.value_pence != null ? (job.value_pence / 100).toFixed(2) : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clients, setClients] = useState<{ id: string; display_name: string | null }[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [members, setMembers] = useState<{ user_id: string; name: string | null; email: string | null }[]>([]);
  const [assignments, setAssignments] = useState<{ user_id: string; role_on_job: string | null }[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [assignRole, setAssignRole] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    setClientsLoading(true);
    setClientsError(null);
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
      .catch((err) => {
        setClientsError(err instanceof Error ? err.message : 'Failed to load clients');
        setClients([]);
        toast.error(getErrorMessage(err));
      })
      .finally(() => setClientsLoading(false));
  }, [accountId]);

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
    if (!accountId || !jobId) return;
    setAssignmentsLoading(true);
    listJobAssignments({ accountId, jobId })
      .then((result: unknown) => {
        const raw = result as { data?: unknown } | unknown[];
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: unknown })?.data)
            ? (raw as { data: unknown[] }).data
            : [];
        setAssignments((list ?? []) as { user_id: string; role_on_job: string | null }[]);
      })
      .catch(() => setAssignments([]))
      .finally(() => setAssignmentsLoading(false));
  }, [accountId, jobId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSubmitting(true);
    try {
      await updateJob({
        accountId,
        jobId,
        title: title.trim(),
        description: description.trim() || null,
        client_id: clientId.trim() || null,
        status: status as 'pending' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled',
        priority: priority as 'low' | 'medium' | 'high' | 'urgent',
        due_date: dueDate ? new Date(dueDate) : null,
        value_pence: valuePence ? Math.round(parseFloat(valuePence) * 100) : null,
      });
      toast.success('Job updated');
      router.push(detailPath);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteJob({ accountId, jobId });
      toast.success('Job deleted');
      setDeleteDialogOpen(false);
      router.push(jobsPath);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedMemberId) return;
    setAssigning(true);
    try {
      await addJobAssignment({
        accountId,
        jobId,
        userId: selectedMemberId,
        role_on_job: assignRole.trim() || undefined,
      });
      toast.success('Team member assigned');
      setSelectedMemberId('');
      setAssignRole('');
      const result = await listJobAssignments({ accountId, jobId });
      const raw = result as { data?: unknown } | unknown[];
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data?: unknown })?.data)
          ? (raw as { data: unknown[] }).data
          : [];
      setAssignments((list ?? []) as { user_id: string; role_on_job: string | null }[]);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveAssignment = async (userId: string) => {
    try {
      await removeJobAssignment({ accountId, jobId, userId });
      toast.success('Assignment removed');
      setAssignments((prev) => prev.filter((a) => a.user_id !== userId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const assignedUserIds = new Set(assignments.map((a) => a.user_id));
  const membersNotAssigned = members.filter((m) => !assignedUserIds.has(m.user_id));

  if (!canEditJobs) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-8">
        <p className="text-center text-zinc-400">You don&apos;t have permission to edit this job.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href={detailPath}
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to job
      </Link>

      <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="title" className="text-zinc-300">
              Title *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 border-zinc-600 bg-zinc-800 text-white"
              placeholder="Job title"
            />
          </div>
          <div>
            <Label className="text-zinc-300">Client</Label>
            <div className="mt-1">
              <ClientCombobox
                clients={clients}
                value={clientId}
                onValueChange={setClientId}
                loading={clientsLoading}
                placeholder="Select client"
                addClientHref={pathsConfig.app.accountClients.replace('[account]', accountSlug)}
              />
            </div>
            {clientsError && (
              <p className="mt-1.5 text-sm text-amber-500">{clientsError}</p>
            )}
          </div>
          <div>
            <Label htmlFor="description" className="text-zinc-300">
              Description
            </Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500"
              placeholder="Optional description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-zinc-300">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1 border-zinc-600 bg-zinc-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-zinc-300">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1 border-zinc-600 bg-zinc-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="due_date" className="text-zinc-300">
              Due date
            </Label>
            <Input
              id="due_date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 border-zinc-600 bg-zinc-800 text-white"
            />
          </div>
          <div>
            <Label htmlFor="value" className="text-zinc-300">
              Value (£)
            </Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              min="0"
              value={valuePence}
              onChange={(e) => setValuePence(e.target.value)}
              className="mt-1 border-zinc-600 bg-zinc-800 text-white"
              placeholder="0.00"
            />
          </div>

          <div className="border-t border-zinc-700 pt-6">
            <h3 className="text-sm font-medium text-zinc-400">Assigned team</h3>
            {assignmentsLoading ? (
              <p className="mt-2 text-sm text-zinc-500">Loading…</p>
            ) : (
              <>
                <ul className="mt-2 space-y-1.5 text-sm text-zinc-300">
                  {assignments.map((a) => {
                    const member = members.find((m) => m.user_id === a.user_id);
                    const label = member ? member.name || member.email || a.user_id.slice(0, 8) : a.user_id.slice(0, 8);
                    return (
                      <li
                        key={a.user_id}
                        className="flex items-center justify-between rounded-md border border-zinc-700 bg-[var(--workspace-shell-panel)] px-3 py-2"
                      >
                        <span>
                          {a.role_on_job ? `${a.role_on_job}: ` : ''}
                          {label}
                        </span>
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
                {assignments.length === 0 && (
                  <p className="mt-2 text-sm text-zinc-500">No one assigned yet.</p>
                )}
                <div className="mt-4 flex flex-wrap items-end gap-2">
                  <div className="min-w-[180px]">
                    <Label className="text-xs text-zinc-500">Add team member</Label>
                    <Select
                      value={selectedMemberId || 'none'}
                      onValueChange={(v) => setSelectedMemberId(v === 'none' ? '' : v)}
                      disabled={membersNotAssigned.length === 0}
                    >
                      <SelectTrigger className="mt-1 border-zinc-600 bg-zinc-800 text-white">
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
                  </div>
                  <Input
                    placeholder="Role (optional)"
                    value={assignRole}
                    onChange={(e) => setAssignRole(e.target.value)}
                    className="h-9 w-32 border-zinc-600 bg-zinc-800 text-white"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="bg-zinc-700 hover:bg-zinc-600"
                    disabled={!selectedMemberId || assigning}
                    onClick={handleAssign}
                  >
                    {assigning ? 'Adding…' : 'Assign'}
                  </Button>
                </div>
                {membersNotAssigned.length === 0 && members.length > 0 && (
                  <p className="mt-2 text-sm text-zinc-500">All members are already assigned.</p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-700 pt-6">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {submitting ? 'Saving...' : 'Save changes'}
            </Button>
            <Button type="button" variant="outline" className="border-zinc-600 text-zinc-300" asChild>
              <Link href={detailPath}>Cancel</Link>
            </Button>

            {canDeleteJobs && (
              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="ml-auto border-red-900/50 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete job
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-zinc-700 bg-[var(--workspace-shell-panel)] text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. The job and all its assignments and notes will be
                      permanently removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2 sm:gap-0">
                    <AlertDialogCancel className="border-zinc-600 text-zinc-300">
                      Cancel
                    </AlertDialogCancel>
                    <Button
                      variant="destructive"
                      disabled={deleting}
                      onClick={handleDelete}
                      className="bg-red-600 hover:bg-red-500"
                    >
                      {deleting ? 'Deleting...' : 'Delete job'}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
