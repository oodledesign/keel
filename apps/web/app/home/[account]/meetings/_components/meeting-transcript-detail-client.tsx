'use client';

import { useEffect, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Check,
  ChevronLeft,
  Copy,
  Loader2,
  Mic,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { workspacePageContentClassName } from '~/components/workspace-shell/workspace-shell-styles';
import pathsConfig from '~/config/paths.config';
import type { TaskAssignmentOption } from '~/home/(user)/_lib/actions/task-actions';
import { ExtractWorkspaceTasksClient } from '~/home/[account]/tasks/_components/extract-workspace-tasks-client';
import {
  type SpeakerMappings,
  type TranscriptSegment,
  serializeResolvedTranscriptSegments,
} from '~/lib/recorder/transcript-speakers';

import {
  deleteMeetingTranscript,
  updateMeetingTranscript,
  updateMeetingTranscriptContent,
} from '../../meeting-transcripts/_lib/server/server-actions';
import { meetingDisplayDate } from '../_lib/format-meeting-date';
import { MeetingSpeakerLabelsEditor } from './meeting-speaker-labels-editor';
import { MeetingTranscriptSegments } from './meeting-transcript-segments';
import type { SpeakerPickerMember } from './speaker-label-picker';

type Transcript = {
  id: string;
  title: string;
  content: string;
  speakerSegments: TranscriptSegment[];
  speakerMappings: SpeakerMappings;
  calendarAttendees: Array<{ name: string; email: string }>;
  meetingDate: string | null;
  createdAt: string;
  clientId: string | null;
  dealId: string | null;
  clientName: string | null;
  dealTitle: string | null;
};

type MeetingSummary = {
  summaryText: string;
  attendeeEmails: string[];
  generatedAt: string;
} | null;

type ClientOption = { id: string; name: string };
type ContactOption = { id: string; name: string; email?: string | null };

type Props = {
  accountId: string;
  accountSlug: string;
  transcript: Transcript;
  summary: MeetingSummary;
  clients: ClientOption[];
  contacts: ContactOption[];
  members: SpeakerPickerMember[];
  currentUserId: string;
  canEdit: boolean;
  assignmentOptions: TaskAssignmentOption[];
};

const panelClassName =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 shadow-sm';

export function MeetingTranscriptDetailClient({
  accountId,
  accountSlug,
  transcript,
  summary,
  clients,
  contacts: initialContacts,
  members,
  currentUserId,
  canEdit,
  assignmentOptions,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(transcript.title);
  const [meetingDate, setMeetingDate] = useState(
    transcript.meetingDate ?? transcript.createdAt.slice(0, 10),
  );
  const [clientId, setClientId] = useState(transcript.clientId ?? '');
  const [mappings, setMappings] = useState<SpeakerMappings>(
    transcript.speakerMappings,
  );
  const [contacts, setContacts] = useState<ContactOption[]>(initialContacts);
  const [copied, setCopied] = useState(false);
  const [extractOpen, setExtractOpen] = useState(false);
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [draftSegments, setDraftSegments] = useState<TranscriptSegment[]>(
    transcript.speakerSegments,
  );
  const [draftContent, setDraftContent] = useState(transcript.content);
  const [pending, startTransition] = useTransition();
  const memberLookup = members.map((member) => ({
    userId: member.userId,
    name: member.name,
  }));

  useEffect(() => {
    setMappings(transcript.speakerMappings);
  }, [transcript.speakerMappings]);

  useEffect(() => {
    setContacts(initialContacts);
  }, [initialContacts]);

  useEffect(() => {
    setDraftSegments(transcript.speakerSegments);
    setDraftContent(transcript.content);
    setEditingTranscript(false);
  }, [transcript.id, transcript.speakerSegments, transcript.content]);

  const meetingsPath = pathsConfig.app.accountMeetings.replace(
    '[account]',
    accountSlug,
  );
  const tasksPath = pathsConfig.app.accountTasks.replace(
    '[account]',
    accountSlug,
  );
  const clientPath = clientId
    ? `${pathsConfig.app.accountClients.replace('[account]', accountSlug)}/${clientId}`
    : null;

  const resolvedClientName =
    transcript.clientName ||
    clients.find((client) => client.id === clientId)?.name ||
    null;
  const contextLabel = resolvedClientName || transcript.dealTitle;
  const displayContent =
    transcript.speakerSegments.length > 0
      ? serializeResolvedTranscriptSegments(
          editingTranscript ? draftSegments : transcript.speakerSegments,
          mappings,
          clients,
          contacts,
          memberLookup,
        )
      : editingTranscript
        ? draftContent
        : transcript.content;

  const saveMeta = () => {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        await updateMeetingTranscript({
          accountId,
          accountSlug,
          transcriptId: transcript.id,
          title: title.trim() || 'Meeting transcript',
          meetingDate: meetingDate || null,
        });
        toast.success('Meeting updated');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Update failed');
      }
    });
  };

  const saveClientLink = (nextClientId: string) => {
    if (!canEdit) return;
    if (!nextClientId) {
      toast.error('Choose a client');
      return;
    }

    setClientId(nextClientId);
    startTransition(async () => {
      try {
        await updateMeetingTranscript({
          accountId,
          accountSlug,
          transcriptId: transcript.id,
          clientId: nextClientId,
          dealId: null,
        });
        toast.success('Client link updated');
        router.refresh();
      } catch (error) {
        setClientId(transcript.clientId ?? '');
        toast.error(error instanceof Error ? error.message : 'Update failed');
      }
    });
  };

  const remove = () => {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        await deleteMeetingTranscript({
          accountId,
          accountSlug,
          transcriptId: transcript.id,
        });
        toast.success('Meeting deleted');
        router.push(meetingsPath);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Delete failed');
      }
    });
  };

  const copyTranscript = async () => {
    if (!displayContent.trim()) {
      toast.error('Nothing to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(displayContent);
      setCopied(true);
      toast.success('Transcript copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const startEditingTranscript = () => {
    setDraftSegments(transcript.speakerSegments);
    setDraftContent(transcript.content);
    setEditingTranscript(true);
  };

  const cancelEditingTranscript = () => {
    setDraftSegments(transcript.speakerSegments);
    setDraftContent(transcript.content);
    setEditingTranscript(false);
  };

  const saveTranscript = () => {
    if (!canEdit) return;

    startTransition(async () => {
      try {
        if (transcript.speakerSegments.length > 0) {
          await updateMeetingTranscriptContent({
            accountId,
            accountSlug,
            transcriptId: transcript.id,
            speakerSegments: draftSegments,
          });
        } else {
          await updateMeetingTranscriptContent({
            accountId,
            accountSlug,
            transcriptId: transcript.id,
            content: draftContent,
          });
        }
        toast.success('Transcript updated');
        setEditingTranscript(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Update failed');
      }
    });
  };

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-6xl space-y-6 pt-2 pb-16',
        workspacePageContentClassName,
      )}
    >
      <Link
        href={meetingsPath}
        className="inline-flex items-center gap-1 text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
      >
        <ChevronLeft className="h-4 w-4" />
        All meetings
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-6">
          {summary ? (
            <section className={panelClassName}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--ozer-accent)]" />
                  <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                    Summary
                  </h2>
                </div>
                {summary.attendeeEmails.length > 0 ? (
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    {summary.attendeeEmails.length} attendee
                    {summary.attendeeEmails.length === 1 ? '' : 's'} from
                    calendar
                  </p>
                ) : null}
              </div>
              <div className="space-y-4 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4 text-sm leading-relaxed text-[var(--workspace-shell-text)]">
                {summary.summaryText.split('\n\n').map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </div>
            </section>
          ) : null}

          <section className={panelClassName}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-[var(--ozer-accent)]" />
                <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                  Transcript
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canEdit && !editingTranscript ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
                    onClick={startEditingTranscript}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit transcript
                  </Button>
                ) : null}
                {canEdit && editingTranscript ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                      onClick={saveTranscript}
                    >
                      {pending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
                      onClick={cancelEditingTranscript}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
                  onClick={() => void copyTranscript()}
                >
                  {copied ? (
                    <Check className="mr-2 h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copied ? 'Copied' : 'Copy transcript'}
                </Button>
              </div>
            </div>
            <div className="max-h-[min(70vh,720px)] overflow-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4 text-sm leading-relaxed text-[var(--workspace-shell-text)]">
              {transcript.speakerSegments.length > 0 ? (
                <MeetingTranscriptSegments
                  accountId={accountId}
                  accountSlug={accountSlug}
                  transcriptId={transcript.id}
                  segments={transcript.speakerSegments}
                  mappings={mappings}
                  clients={clients}
                  contacts={contacts}
                  members={members}
                  currentUserId={currentUserId}
                  linkClientId={clientId || transcript.clientId}
                  canEdit={canEdit}
                  editing={editingTranscript}
                  draftSegments={draftSegments}
                  onDraftChange={setDraftSegments}
                  onSaved={() => router.refresh()}
                  onMappingsChange={setMappings}
                  onContactsChange={setContacts}
                />
              ) : editingTranscript ? (
                <Textarea
                  value={draftContent}
                  onChange={(event) => setDraftContent(event.target.value)}
                  className="min-h-[min(60vh,640px)] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] font-mono text-sm text-[var(--workspace-shell-text)]"
                />
              ) : (
                <pre className="whitespace-pre-wrap">{displayContent}</pre>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className={panelClassName}>
            <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Meeting details
            </h2>

            <div className="mt-4 space-y-4">
              {canEdit ? (
                <>
                  <div>
                    <Label
                      htmlFor="detail-title"
                      className="text-xs text-[var(--workspace-shell-text-muted)]"
                    >
                      Title
                    </Label>
                    <Input
                      id="detail-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={saveMeta}
                      className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="detail-date"
                      className="text-xs text-[var(--workspace-shell-text-muted)]"
                    >
                      Meeting date
                    </Label>
                    <Input
                      id="detail-date"
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      onBlur={saveMeta}
                      className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="detail-client"
                      className="text-xs text-[var(--workspace-shell-text-muted)]"
                    >
                      Client
                    </Label>
                    <Select
                      value={clientId || undefined}
                      onValueChange={saveClientLink}
                      disabled={pending}
                    >
                      <SelectTrigger
                        id="detail-client"
                        className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                      >
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                      Title
                    </p>
                    <p className="mt-1 font-medium text-[var(--workspace-shell-text)]">
                      {transcript.title}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                      Meeting date
                    </p>
                    <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
                      {meetingDisplayDate(
                        transcript.meetingDate,
                        transcript.createdAt,
                      )}
                    </p>
                  </div>
                </>
              )}

              {contextLabel ? (
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  {clientPath && resolvedClientName ? (
                    <>
                      Client:{' '}
                      <Link
                        href={clientPath}
                        className="text-[var(--ozer-accent-muted)] hover:underline"
                      >
                        {resolvedClientName}
                      </Link>
                    </>
                  ) : transcript.dealTitle ? (
                    <>Linked to deal: {transcript.dealTitle}</>
                  ) : (
                    <>Linked to: {contextLabel}</>
                  )}
                </p>
              ) : canEdit ? (
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  No client linked yet.
                </p>
              ) : null}
            </div>

            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                className="mt-5 w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={remove}
              >
                {pending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete meeting
              </Button>
            ) : null}
          </section>

          <section className={panelClassName}>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--ozer-accent)]" />
              <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                Extract tasks
              </h2>
            </div>
            <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
              Review AI-suggested tasks from this transcript before adding them
              to the workspace.
            </p>
            <Button
              type="button"
              className="mt-4 w-full bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              onClick={() => setExtractOpen(true)}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Extract tasks with AI
            </Button>
          </section>

          <MeetingSpeakerLabelsEditor
            accountId={accountId}
            accountSlug={accountSlug}
            transcriptId={transcript.id}
            speakerSegments={transcript.speakerSegments}
            initialMappings={mappings}
            clients={clients}
            contacts={contacts}
            members={members}
            currentUserId={currentUserId}
            linkClientId={clientId || transcript.clientId}
            canEdit={canEdit}
            onSaved={() => router.refresh()}
            onMappingsChange={setMappings}
            onContactsChange={setContacts}
          />
        </aside>
      </div>

      <Dialog open={extractOpen} onOpenChange={setExtractOpen}>
        <DialogContent className="max-h-[min(90vh,900px)] max-w-6xl gap-0 overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0 text-[var(--workspace-shell-text)]">
          <DialogHeader className="border-b border-[color:var(--workspace-shell-border)] px-6 py-4">
            <DialogTitle>Extract tasks</DialogTitle>
            <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
              AI will analyse this meeting transcript and suggest actionable
              tasks. Review and edit before adding them to the workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(min(90vh,900px)-5.5rem)] overflow-y-auto px-6 py-5">
            {extractOpen ? (
              <ExtractWorkspaceTasksClient
                accountId={accountId}
                accountSlug={accountSlug}
                assignmentOptions={assignmentOptions}
                embedded
                initialRawText={displayContent}
                defaultClientId={clientId || transcript.clientId}
                successRedirectHref={tasksPath}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
