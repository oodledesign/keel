'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  ArrowLeft,
  Calendar,
  FileText,
  MessageSquare,
  Pencil,
  UserPlus,
  Users,
  Wallet,
  Briefcase,
  ClipboardList,
} from 'lucide-react';
import Link from 'next/link';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';

import {
  addJobAssignment,
  addJobNote,
  listAccountMembers,
  listJobAssignments,
  listJobNotes,
  removeJobAssignment,
} from '../_lib/server/server-actions';
import { getErrorMessage } from '../_lib/error-message';

import { JobEventsTabContent } from './job-events-tab';
import { JobScheduleTabContent } from './job-schedule-tab';

type Job = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  value_pence: number | null;
  cost_pence: number | null;
  client_id: string | null;
  [key: string]: unknown;
};

type Client = {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
} | null;

type JobNote = {
  id: string;
  note: string;
  author_user_id: string;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

function formatDueDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatValue(pence: number | null): string {
  if (pence == null) return '—';
  return `£${(pence / 100).toFixed(2)}`;
}

function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })} ${d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function JobDetailContent({
  accountSlug,
  accountId,
  jobId,
  job,
  client,
  canViewJobs,
  canEditJobs,
  isContractorView,
}: {
  accountSlug: string;
  accountId: string;
  jobId: string;
  job: Job;
  client: Client;
  canViewJobs: boolean;
  canEditJobs: boolean;
  isContractorView: boolean;
}) {
  const jobsPath = pathsConfig.app.accountJobs.replace('[account]', accountSlug);
  const clientsPath = pathsConfig.app.accountClients.replace('[account]', accountSlug);

  const [assignments, setAssignments] = useState<{ user_id: string; role_on_job: string | null }[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [members, setMembers] = useState<{ user_id: string; name: string | null; email: string | null }[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [assignRole, setAssignRole] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const refreshAssignments = useCallback(() => {
    if (!accountId || !jobId) return;
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
      .catch(() => setAssignments([]));
  }, [accountId, jobId]);

  const refreshNotes = useCallback(() => {
    if (!accountId || !jobId) return;
    setNotesLoading(true);
    listJobNotes({ accountId, jobId })
      .then((result: unknown) => {
        const raw = result as unknown[] | { data?: unknown };
        const list = Array.isArray(raw) ? raw : Array.isArray((raw as { data?: unknown }).data) ? (raw as { data: unknown[] }).data : [];
        setNotes((list ?? []) as JobNote[]);
      })
      .catch(() => setNotes([]))
      .finally(() => setNotesLoading(false));
  }, [accountId, jobId]);

  useEffect(() => {
    if (!accountId || !jobId) return;
    setLoadingAssignments(true);
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
      .catch(() => {
        toast.error('Failed to load assignments');
        setAssignments([]);
      })
      .finally(() => setLoadingAssignments(false));
  }, [accountId, jobId]);

  useEffect(() => {
    if (!accountSlug || !canEditJobs) return;
    listAccountMembers({ accountSlug })
      .then((raw: unknown) => {
        const list = Array.isArray(raw) ? raw : [];
        setMembers(list as { user_id: string; name: string | null; email: string | null }[]);
      })
      .catch(() => setMembers([]));
  }, [accountSlug, canEditJobs]);

  useEffect(() => {
    refreshNotes();
  }, [refreshNotes]);

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
      refreshAssignments();
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
      refreshAssignments();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const note = newNote.trim();
    if (!note) return;
    setAddingNote(true);
    try {
      await addJobNote({ accountId, jobId, note });
      toast.success('Note added');
      setNewNote('');
      refreshNotes();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAddingNote(false);
    }
  };

  const assignedUserIds = new Set(assignments.map((a) => a.user_id));
  const membersNotAssigned = members.filter((m) => !assignedUserIds.has(m.user_id));

  if (!canViewJobs) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-8">
        <p className="text-center text-zinc-400">You don&apos;t have access to this job.</p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[1600px] flex-1 flex-col gap-6 lg:flex-row">
      {/* Main content */}
      <div className="min-w-0 flex-1">
        <Link
          href={jobsPath}
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to jobs
        </Link>

        <div className="rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">{job.title}</h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    job.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : job.status === 'cancelled'
                        ? 'bg-zinc-600 text-zinc-400'
                        : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {STATUS_LABELS[job.status] ?? job.status}
                </span>
                <span className="rounded-full bg-zinc-600 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
                  {PRIORITY_LABELS[job.priority] ?? job.priority}
                </span>
              </div>
            </div>
            {canEditJobs && (
              <Button asChild variant="outline" size="sm" className="border-zinc-600 text-zinc-300">
                <Link
                  href={pathsConfig.app.accountJobEdit.replace('[account]', accountSlug).replace('[id]', jobId)}
                  className="inline-flex items-center gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
            )}
          </div>

          {/* Key stats strip */}
            <div className="mt-6 flex flex-wrap gap-6 border-b border-zinc-700 pb-4">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Due date</span>
              <p className="mt-0.5 text-white">{formatDueDate(job.due_date)}</p>
            </div>
              {!isContractorView && (
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Value</span>
                  <p className="mt-0.5 text-white">{formatValue(job.value_pence)}</p>
                </div>
              )}
            {client && (
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Client</span>
                <p className="mt-0.5">
                  <Link href={clientsPath} className="text-zinc-300 underline hover:text-white">
                    {client.display_name ?? 'Client'}
                  </Link>
                </p>
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="mt-6">
            <TabsList className="mb-4 flex h-auto flex-wrap gap-1 border-b border-zinc-700 bg-transparent p-0">
              <TabsTrigger value="overview" className="gap-1.5 border-b-2 border-transparent data-[state=active]:border-zinc-400 data-[state=active]:bg-transparent data-[state=active]:text-white">
                <ClipboardList className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-1.5 border-b-2 border-transparent data-[state=active]:border-zinc-400 data-[state=active]:bg-transparent data-[state=active]:text-white">
                <Calendar className="h-4 w-4" />
                Schedule
              </TabsTrigger>
              <TabsTrigger value="team" className="gap-1.5 border-b-2 border-transparent data-[state=active]:border-zinc-400 data-[state=active]:bg-transparent data-[state=active]:text-white">
                <Users className="h-4 w-4" />
                Team
              </TabsTrigger>
              <TabsTrigger value="messages" className="gap-1.5 border-b-2 border-transparent data-[state=active]:border-zinc-400 data-[state=active]:bg-transparent data-[state=active]:text-white">
                <MessageSquare className="h-4 w-4" />
                Messages
              </TabsTrigger>
              <TabsTrigger value="visits" className="gap-1.5 border-b-2 border-transparent data-[state=active]:border-zinc-400 data-[state=active]:bg-transparent data-[state=active]:text-white">
                <Briefcase className="h-4 w-4" />
                Visits & Meetings
              </TabsTrigger>
              {!isContractorView && (
                <TabsTrigger value="finance" className="gap-1.5 border-b-2 border-transparent data-[state=active]:border-zinc-400 data-[state=active]:bg-transparent data-[state=active]:text-white">
                  <Wallet className="h-4 w-4" />
                  Finance
                </TabsTrigger>
              )}
              {!isContractorView && (
                <TabsTrigger value="docs" className="gap-1.5 border-b-2 border-transparent data-[state=active]:border-zinc-400 data-[state=active]:bg-transparent data-[state=active]:text-white">
                  <FileText className="h-4 w-4" />
                  Docs
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <div className="prose prose-invert max-w-none text-sm">
                <p className="text-zinc-300">
                  {job.description || 'No description.'}
                </p>
                <ul className="mt-4 list-disc space-y-1 pl-5 text-zinc-400">
                  <li>
                    Due: {formatDueDate(job.due_date)}
                    {!isContractorView ? ` · Value: ${formatValue(job.value_pence)}` : ''}
                  </li>
                  <li>Team: {assignments.length} member{assignments.length !== 1 ? 's' : ''} assigned</li>
                  <li>Notes: {notes.length} note{notes.length !== 1 ? 's' : ''}</li>
                  <li>
                    Use the tabs above for Schedule, Team, Messages and Visits.
                    {!isContractorView ? ' Finance and Docs are also available.' : ''}
                  </li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="schedule" className="mt-4">
              <JobScheduleTabContent
                accountId={accountId}
                jobId={jobId}
                accountSlug={accountSlug}
                canEditJobs={canEditJobs}
              />
            </TabsContent>

            <TabsContent value="team" className="mt-4">
              {loadingAssignments ? (
                <p className="text-sm text-zinc-500">Loading…</p>
              ) : (
                <>
                  <ul className="space-y-1.5 text-sm text-zinc-300">
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
                          {canEditJobs && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-zinc-400 hover:text-red-400"
                              onClick={() => handleRemoveAssignment(a.user_id)}
                            >
                              Remove
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {assignments.length === 0 && (
                    <p className="text-sm text-zinc-500">No one assigned yet.</p>
                  )}
                  {canEditJobs && members.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-end gap-2">
                      <div className="min-w-[180px]">
                        <Label className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <UserPlus className="h-3.5 w-3.5" />
                          Add team member
                        </Label>
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
                        className={selectedMemberId && !assigning ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400'}
                        disabled={!selectedMemberId || assigning}
                        onClick={handleAssign}
                      >
                        {assigning ? 'Adding…' : 'Assign'}
                      </Button>
                    </div>
                  )}
                  {canEditJobs && membersNotAssigned.length === 0 && members.length > 0 && (
                    <p className="mt-2 text-sm text-zinc-500">All members are already assigned.</p>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="messages" className="mt-4">
              <p className="text-sm text-zinc-500">Messages coming soon.</p>
            </TabsContent>

            <TabsContent value="visits" className="mt-4">
              <JobEventsTabContent
                accountSlug={accountSlug}
                accountId={accountId}
                jobId={jobId}
                canEditJobs={canEditJobs}
              />
            </TabsContent>

            {!isContractorView && (
              <TabsContent value="finance" className="mt-4">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-zinc-400">Value</dt>
                    <dd className="mt-0.5 text-white">{formatValue(job.value_pence)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-zinc-400">Cost</dt>
                    <dd className="mt-0.5 text-white">{formatValue(job.cost_pence)}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-sm text-zinc-500">Invoices and more finance features coming soon.</p>
              </TabsContent>
            )}

            {!isContractorView && (
              <TabsContent value="docs" className="mt-4">
                <p className="text-sm text-zinc-500">Proposals, agreements, invoices and other files coming soon.</p>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="w-full shrink-0 lg:w-80">
        <div className="space-y-6">
          {client && (
            <div className="rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-4">
              <h3 className="text-sm font-medium text-zinc-400">Client</h3>
              <div className="mt-3 space-y-2 text-sm">
                <p className="font-medium text-white">
                  <Link href={clientsPath} className="hover:underline">
                    {client.display_name ?? 'Unnamed'}
                  </Link>
                </p>
                {client.company_name && (
                  <p className="text-zinc-400">{client.company_name}</p>
                )}
                {client.email && (
                  <p className="text-zinc-400">
                    <a href={`mailto:${client.email}`} className="text-zinc-400 hover:text-white">
                      {client.email}
                    </a>
                  </p>
                )}
                {client.phone && (
                  <p className="text-zinc-400">
                    <a href={`tel:${client.phone}`} className="text-zinc-400 hover:text-white">
                      {client.phone}
                    </a>
                  </p>
                )}
                <Link
                  href={clientsPath}
                  className="inline-block text-xs text-zinc-500 underline hover:text-white"
                >
                  View client →
                </Link>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-4">
            <h3 className="text-sm font-medium text-zinc-400">Activity & notes</h3>
            {notesLoading ? (
              <p className="mt-3 text-sm text-zinc-500">Loading…</p>
            ) : (
              <>
                <ul className="mt-3 space-y-3">
                  {notes.map((n) => (
                    <li key={n.id} className="border-l-2 border-zinc-600 pl-3 text-sm">
                      <p className="text-zinc-300 whitespace-pre-wrap">{n.note}</p>
                      <p className="mt-1 text-xs text-zinc-500">{formatNoteDate(n.created_at)}</p>
                    </li>
                  ))}
                </ul>
                {notes.length === 0 && (
                  <p className="mt-3 text-sm text-zinc-500">No notes yet.</p>
                )}
                {canEditJobs && (
                  <form onSubmit={handleAddNote} className="mt-4">
                    <Label htmlFor="new-note" className="text-xs text-zinc-500">
                      Add note
                    </Label>
                    <textarea
                      id="new-note"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={3}
                      placeholder="Write a note…"
                      className="mt-1 w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className={`mt-2 ${newNote.trim() && !addingNote ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400'}`}
                      disabled={!newNote.trim() || addingNote}
                    >
                      {addingNote ? 'Adding…' : 'Add note'}
                    </Button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
