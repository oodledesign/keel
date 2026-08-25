'use client';

import { useEffect, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Copy,
  FileUp,
  Globe,
  Link2,
  Loader2,
  Mail,
  Mic,
  MoreHorizontal,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { MeetingSummaryMarkdown } from '~/components/meetings/meeting-summary-markdown';
import { workspacePageContentClassName } from '~/components/workspace-shell/workspace-shell-styles';
import pathsConfig from '~/config/paths.config';
import type { TaskAssignmentOption } from '~/home/(user)/_lib/actions/task-actions';
import { ExtractWorkspaceTasksClient } from '~/home/[account]/tasks/_components/extract-workspace-tasks-client';
import { buildPublicMeetingShareUrl } from '~/lib/recorder/public-meeting-share';
import {
  type SpeakerMappings,
  type TranscriptSegment,
  parseTranscriptContent,
  serializeResolvedTranscriptSegments,
} from '~/lib/recorder/transcript-speakers';

import {
  deleteMeetingTranscript,
  emailMeetingNotes,
  generateMeetingSummary,
  setMeetingPortalVisible,
  setMeetingPublicShare,
  setMeetingPublicShareShowTasks,
  updateMeetingTranscript,
  updateMeetingTranscriptContent,
} from '../../meeting-transcripts/_lib/server/server-actions';
import { meetingDisplayDate } from '../_lib/format-meeting-date';
import { MeetingSpeakerLabelsEditor } from './meeting-speaker-labels-editor';
import {
  HighlightedText,
  countSegmentMatches,
  findTextMatches,
} from './meeting-transcript-highlight';
import { MeetingTranscriptQaChat } from './meeting-transcript-qa-chat';
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
  publicShareEnabled?: boolean;
  publicShareToken?: string | null;
  publicShareShowTasks?: boolean;
  portalVisible?: boolean;
};

type MeetingSummary = {
  summaryText: string;
  attendeeEmails: string[];
  generatedAt: string;
} | null;

type MeetingTask = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  assigneeName: string | null;
  plannerTaskId: string | null;
};

type ClientOption = {
  id: string;
  name: string;
  pictureUrl?: string | null;
};
type ContactOption = { id: string; name: string; email?: string | null };

type Props = {
  accountId: string;
  accountSlug: string;
  transcript: Transcript;
  summary: MeetingSummary;
  meetingTasks?: MeetingTask[];
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
  meetingTasks = [],
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
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [shareEnabled, setShareEnabled] = useState(
    Boolean(transcript.publicShareEnabled),
  );
  const [shareToken, setShareToken] = useState(
    transcript.publicShareToken ?? null,
  );
  const [shareShowTasks, setShareShowTasks] = useState(
    transcript.publicShareShowTasks !== false,
  );
  const [portalVisible, setPortalVisible] = useState(
    Boolean(transcript.portalVisible),
  );
  const [extractOpen, setExtractOpen] = useState(false);
  const [emailNotesOpen, setEmailNotesOpen] = useState(false);
  const [selectedRecipientEmails, setSelectedRecipientEmails] = useState<
    string[]
  >([]);
  const [extraRecipientEmail, setExtraRecipientEmail] = useState('');
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [draftSegments, setDraftSegments] = useState<TranscriptSegment[]>(
    transcript.speakerSegments,
  );
  const [draftContent, setDraftContent] = useState(transcript.content);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const memberLookup = members.map((member) => ({
    userId: member.userId,
    name: member.name,
  }));
  const showSegmentEditor = editingTranscript
    ? draftSegments.length > 0
    : transcript.speakerSegments.length > 0;

  useEffect(() => {
    setShareEnabled(Boolean(transcript.publicShareEnabled));
    setShareToken(transcript.publicShareToken ?? null);
    setShareShowTasks(transcript.publicShareShowTasks !== false);
    setPortalVisible(Boolean(transcript.portalVisible));
  }, [
    transcript.publicShareEnabled,
    transcript.publicShareToken,
    transcript.publicShareShowTasks,
    transcript.portalVisible,
  ]);

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

  const participantEmailOptions = Array.from(
    new Set(
      [
        ...transcript.calendarAttendees.map((attendee) => attendee.email),
        ...(summary?.attendeeEmails ?? []),
        ...contacts.map((contact) => contact.email ?? ''),
      ]
        .map((email) => email.trim().toLowerCase())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const openEmailNotesDialog = (preselectAll = true) => {
    setSelectedRecipientEmails(
      preselectAll ? participantEmailOptions : selectedRecipientEmails,
    );
    setExtraRecipientEmail('');
    setEmailNotesOpen(true);
  };

  const resolvedClient =
    clients.find((client) => client.id === clientId) ?? null;
  const resolvedClientName =
    transcript.clientName || resolvedClient?.name || null;
  const resolvedClientPictureUrl = resolvedClient?.pictureUrl ?? null;
  const displayContent =
    (editingTranscript ? draftSegments : transcript.speakerSegments).length > 0
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

  const searchableSegments = editingTranscript
    ? draftSegments
    : transcript.speakerSegments;
  const transcriptMatchCount =
    searchableSegments.length > 0
      ? countSegmentMatches(searchableSegments, transcriptSearch)
      : findTextMatches(displayContent, transcriptSearch).length;

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [transcriptSearch, transcript.id]);

  useEffect(() => {
    if (!transcriptSearch.trim() || transcriptMatchCount === 0) {
      return;
    }

    const clamped = Math.min(
      Math.max(activeMatchIndex, 0),
      transcriptMatchCount - 1,
    );
    if (clamped !== activeMatchIndex) {
      setActiveMatchIndex(clamped);
      return;
    }

    const mark = document.querySelector(`[data-transcript-match="${clamped}"]`);
    mark?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [
    activeMatchIndex,
    transcriptMatchCount,
    transcriptSearch,
    editingTranscript,
  ]);

  const goToMatch = (direction: 1 | -1) => {
    if (transcriptMatchCount === 0) return;
    setActiveMatchIndex(
      (current) =>
        (current + direction + transcriptMatchCount) % transcriptMatchCount,
    );
  };

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
      setCopiedSummary(false);
      toast.success('Transcript copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const copySummary = async () => {
    const text = summary?.summaryText?.trim();
    if (!text) {
      toast.error('Nothing to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setCopied(false);
      toast.success('Summary copied');
      window.setTimeout(() => setCopiedSummary(false), 2000);
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
    setImportOpen(false);
    setImportText('');
    setEditingTranscript(false);
  };

  const applyImportedTranscript = (raw: string) => {
    const trimmed = raw.trim();

    if (!trimmed) {
      toast.error('Paste or upload a transcript first');
      return;
    }

    const parsed = parseTranscriptContent(trimmed);

    if (parsed.hasSpeakerLabels && parsed.segments.length > 0) {
      setDraftSegments(parsed.segments);
      setDraftContent(trimmed);
    } else {
      setDraftSegments([]);
      setDraftContent(trimmed);
    }

    setImportOpen(false);
    setImportText('');
    toast.success('Transcript replaced — save to keep the changes');
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      setImportText(text);
      toast.success(`Loaded ${file.name}`);
    } catch {
      toast.error('Could not read that file');
    }
  };

  const saveTranscript = () => {
    if (!canEdit) return;

    startTransition(async () => {
      try {
        if (draftSegments.length > 0) {
          await updateMeetingTranscriptContent({
            accountId,
            accountSlug,
            transcriptId: transcript.id,
            speakerSegments: draftSegments,
          });
        } else {
          const trimmed = draftContent.trim();

          if (!trimmed) {
            toast.error('Transcript cannot be empty');
            return;
          }

          await updateMeetingTranscriptContent({
            accountId,
            accountSlug,
            transcriptId: transcript.id,
            content: trimmed,
          });
        }
        toast.success('Transcript updated');
        setEditingTranscript(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save transcript',
        );
      }
    });
  };

  const generateSummary = (isRegenerate = false) => {
    if (!canEdit) return;
    if (!displayContent.trim()) {
      toast.error('Add transcript content before generating a summary');
      return;
    }

    startTransition(async () => {
      try {
        await generateMeetingSummary({
          accountId,
          accountSlug,
          transcriptId: transcript.id,
        });
        toast.success(
          isRegenerate
            ? 'Meeting summary regenerated'
            : 'Meeting summary generated',
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Summary generation failed',
        );
      }
    });
  };

  const togglePublicShare = (enabled: boolean) => {
    if (!canEdit) return;

    startTransition(async () => {
      try {
        const result = await setMeetingPublicShare({
          accountId,
          accountSlug,
          transcriptId: transcript.id,
          enabled,
        });
        setShareEnabled(result.publicShareEnabled);
        setShareToken(result.publicShareToken);
        setShareShowTasks(result.publicShareShowTasks);
        toast.success(
          result.publicShareEnabled
            ? 'Public meeting link enabled'
            : 'Public meeting link disabled',
        );
        if (result.publicShareEnabled && result.publicShareToken) {
          openEmailNotesDialog(true);
        }
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not update share link',
        );
      }
    });
  };

  const sendEmailNotes = () => {
    if (!canEdit) return;

    const extras = extraRecipientEmail
      .split(/[,;\s]+/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

    const recipientEmails = Array.from(
      new Set([...selectedRecipientEmails, ...extras]),
    );

    if (recipientEmails.length === 0) {
      toast.error('Select or add at least one email');
      return;
    }

    startTransition(async () => {
      try {
        const result = await emailMeetingNotes({
          accountId,
          transcriptId: transcript.id,
          recipientEmails,
        });
        const failedNote =
          result.failed.length > 0
            ? ` (${result.failed.length} failed)`
            : '';
        toast.success(
          `Sent meeting notes to ${result.sent} recipient${result.sent === 1 ? '' : 's'}${failedNote}`,
        );
        setEmailNotesOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not send meeting notes',
        );
      }
    });
  };

  const togglePublicShareShowTasks = (showTasks: boolean) => {
    if (!canEdit) return;

    startTransition(async () => {
      try {
        const result = await setMeetingPublicShareShowTasks({
          accountId,
          accountSlug,
          transcriptId: transcript.id,
          showTasks,
        });
        setShareShowTasks(result.publicShareShowTasks);
        toast.success(
          result.publicShareShowTasks
            ? 'Tasks will appear on the public page'
            : 'Tasks hidden from the public page',
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not update task visibility',
        );
      }
    });
  };

  const togglePortalVisible = (visible: boolean) => {
    if (!canEdit) return;

    startTransition(async () => {
      try {
        const result = await setMeetingPortalVisible({
          accountId,
          accountSlug,
          transcriptId: transcript.id,
          portalVisible: visible,
        });
        setPortalVisible(result.portalVisible);
        toast.success(
          result.portalVisible
            ? 'Meeting shared to client portal'
            : 'Meeting hidden from client portal',
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not update portal access',
        );
      }
    });
  };

  const copyPublicShareLink = async () => {
    if (!shareToken || !shareEnabled) {
      toast.error('Enable the public link first');
      return;
    }

    try {
      await navigator.clipboard.writeText(
        buildPublicMeetingShareUrl(shareToken),
      );
      toast.success('Public link copied');
    } catch {
      toast.error('Could not copy link');
    }
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
          <section className={panelClassName}>
            <Tabs
              defaultValue={summary ? 'summary' : 'transcript'}
              className="gap-0"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <TabsList className="h-auto w-full justify-start gap-1 rounded-xl bg-[var(--workspace-shell-sidebar-accent)] p-1 text-[var(--workspace-shell-text-muted)] sm:w-auto">
                  <TabsTrigger
                    value="summary"
                    className="gap-1.5 rounded-lg px-3 py-2 text-sm data-[state=active]:bg-[var(--workspace-shell-panel)] data-[state=active]:text-[var(--workspace-shell-text)] data-[state=active]:shadow-sm"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
                    Summary
                  </TabsTrigger>
                  <TabsTrigger
                    value="transcript"
                    className="gap-1.5 rounded-lg px-3 py-2 text-sm data-[state=active]:bg-[var(--workspace-shell-panel)] data-[state=active]:text-[var(--workspace-shell-text)] data-[state=active]:shadow-sm"
                  >
                    <Mic className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
                    Transcript
                  </TabsTrigger>
                  <TabsTrigger
                    value="tasks"
                    className="gap-1.5 rounded-lg px-3 py-2 text-sm data-[state=active]:bg-[var(--workspace-shell-panel)] data-[state=active]:text-[var(--workspace-shell-text)] data-[state=active]:shadow-sm"
                  >
                    <CheckSquare className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
                    Tasks
                    {meetingTasks.length > 0 ? (
                      <span className="rounded-md bg-[var(--workspace-shell-panel)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--workspace-shell-text-muted)]">
                        {meetingTasks.length}
                      </span>
                    ) : null}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="summary" className="mt-0 outline-none">
                {summary ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        {summary.attendeeEmails.length > 0 ? (
                          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                            {summary.attendeeEmails.length} attendee
                            {summary.attendeeEmails.length === 1 ? '' : 's'} from
                            calendar
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                          onClick={() => void copySummary()}
                        >
                          {copiedSummary ? (
                            <Check className="mr-2 h-4 w-4 text-emerald-400" />
                          ) : (
                            <Copy className="mr-2 h-4 w-4" />
                          )}
                          {copiedSummary ? 'Copied' : 'Copy summary'}
                        </Button>
                        {canEdit && displayContent.trim() ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                            onClick={() => generateSummary(true)}
                          >
                            {pending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="mr-2 h-4 w-4" />
                            )}
                            Regenerate
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
                      <MeetingSummaryMarkdown markdown={summary.summaryText} />
                    </div>
                  </div>
                ) : canEdit && displayContent.trim() ? (
                  <div className="space-y-4">
                    <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                      No summary yet. Generate one from this meeting transcript.
                    </p>
                    <Button
                      type="button"
                      disabled={pending}
                      className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                      onClick={() => generateSummary(false)}
                    >
                      {pending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Generate meeting summary
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                    No summary for this meeting yet.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="transcript" className="mt-0 outline-none">
                <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
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
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
                        onClick={() => {
                          setImportText('');
                          setImportOpen(true);
                        }}
                      >
                        <FileUp className="mr-2 h-4 w-4" />
                        Replace transcript
                      </Button>
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
                {!editingTranscript ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[12rem] flex-1">
                      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
                      <Input
                        value={transcriptSearch}
                        onChange={(event) =>
                          setTranscriptSearch(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            goToMatch(event.shiftKey ? -1 : 1);
                          }
                        }}
                        placeholder="Search transcript…"
                        className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] pl-9 text-[var(--workspace-shell-text)]"
                        aria-label="Search transcript"
                      />
                    </div>
                    {transcriptSearch.trim() ? (
                      <div className="flex items-center gap-1">
                        <span className="px-1 text-xs text-[var(--workspace-shell-text-muted)]">
                          {transcriptMatchCount === 0
                            ? 'No matches'
                            : `${activeMatchIndex + 1} of ${transcriptMatchCount}`}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={transcriptMatchCount === 0}
                          className="h-8 w-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                          onClick={() => goToMatch(-1)}
                          aria-label="Previous match"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={transcriptMatchCount === 0}
                          className="h-8 w-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                          onClick={() => goToMatch(1)}
                          aria-label="Next match"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="max-h-[min(70vh,720px)] overflow-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4 text-sm leading-relaxed text-[var(--workspace-shell-text)]">
                  {showSegmentEditor ? (
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
                      searchQuery={editingTranscript ? '' : transcriptSearch}
                      activeMatchIndex={activeMatchIndex}
                    />
                  ) : editingTranscript ? (
                    <Textarea
                      value={draftContent}
                      onChange={(event) => setDraftContent(event.target.value)}
                      className="min-h-[min(60vh,640px)] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] font-mono text-sm text-[var(--workspace-shell-text)]"
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap">
                      {transcriptSearch.trim() ? (
                        <HighlightedText
                          text={displayContent}
                          query={transcriptSearch}
                          matchOffset={0}
                          activeMatchIndex={activeMatchIndex}
                        />
                      ) : (
                        displayContent
                      )}
                    </pre>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="tasks" className="mt-0 outline-none">
                {meetingTasks.length > 0 ? (
                  <ul className="space-y-3">
                    {meetingTasks.map((task) => (
                      <li
                        key={task.id}
                        className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-4 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                            {task.title}
                          </p>
                          <span className="text-xs capitalize text-[var(--workspace-shell-text-muted)]">
                            {task.status === 'done'
                              ? 'Completed'
                              : task.status === 'todo' ||
                                  task.status === 'approved' ||
                                  task.status === 'auto_published'
                                ? 'Open'
                                : task.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {task.description ? (
                          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
                            {task.description}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--workspace-shell-text-muted)]">
                          {task.assigneeName ? (
                            <span>Assigned to {task.assigneeName}</span>
                          ) : (
                            <span>Unassigned</span>
                          )}
                          {task.dueDate ? (
                            <span>
                              Due{' '}
                              {new Intl.DateTimeFormat('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              }).format(new Date(`${task.dueDate}T12:00:00`))}
                            </span>
                          ) : (
                            <span>No due date</span>
                          )}
                        </div>
                        {task.plannerTaskId ? (
                          <Link
                            href={tasksPath}
                            className="mt-2 inline-block text-xs font-medium text-[var(--ozer-info)] hover:underline"
                          >
                            Open tasks
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                      No saved tasks from this meeting yet. Extract and save
                      tasks to see them here.
                    </p>
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                        onClick={() => setExtractOpen(true)}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        Extract tasks
                      </Button>
                    ) : null}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </section>

          <MeetingTranscriptQaChat
            accountId={accountId}
            transcriptId={transcript.id}
            disabled={!displayContent.trim()}
          />
        </div>

        <aside className="space-y-6">
          <section className={panelClassName}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                Meeting details
              </h2>
              {canEdit ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                      aria-label="Meeting actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setExtractOpen(true)}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      {meetingTasks.length > 0
                        ? 'Extract more tasks…'
                        : 'Extract tasks…'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>

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
                            <span className="flex items-center gap-2">
                              <ProfileAvatar
                                displayName={client.name}
                                pictureUrl={client.pictureUrl}
                                className="h-6 w-6"
                              />
                              <span>{client.name}</span>
                            </span>
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
                    <p className="mt-1 text-sm text-[var(--workspace-shell-text)]">
                      {meetingDisplayDate(
                        transcript.meetingDate,
                        transcript.createdAt,
                      )}
                    </p>
                  </div>
                </>
              )}

              {clientPath && resolvedClientName ? (
                <Link
                  href={clientPath}
                  className="flex items-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2.5 transition-colors hover:border-[var(--ozer-accent)]/35"
                >
                  <ProfileAvatar
                    displayName={resolvedClientName}
                    pictureUrl={resolvedClientPictureUrl}
                    className="h-10 w-10"
                  />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                      Client
                    </span>
                    <span className="block truncate text-sm font-semibold text-[var(--workspace-shell-text)]">
                      {resolvedClientName}
                    </span>
                  </span>
                </Link>
              ) : transcript.dealTitle ? (
                <p className="text-sm text-[var(--workspace-shell-text)]">
                  Linked to deal:{' '}
                  <span className="font-medium">{transcript.dealTitle}</span>
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

          {canEdit ? (
            <section className={panelClassName}>
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-[var(--ozer-accent)]" />
                <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                  Public link
                </h2>
              </div>
              <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
                Share a read-only page with the summary and transcript.
                Optionally include accepted tasks for the client.
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <Label
                  htmlFor="meeting-public-share"
                  className="text-sm text-[var(--workspace-shell-text)]"
                >
                  Enable public page
                </Label>
                <Switch
                  id="meeting-public-share"
                  checked={shareEnabled}
                  disabled={pending}
                  onCheckedChange={togglePublicShare}
                />
              </div>
              {shareEnabled ? (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <Label
                    htmlFor="meeting-public-share-tasks"
                    className="text-sm text-[var(--workspace-shell-text)]"
                  >
                    Show extracted tasks
                  </Label>
                  <Switch
                    id="meeting-public-share-tasks"
                    checked={shareShowTasks}
                    disabled={pending}
                    onCheckedChange={togglePublicShareShowTasks}
                  />
                </div>
              ) : null}
              {shareEnabled && shareToken ? (
                <div className="mt-3 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                    onClick={() => void copyPublicShareLink()}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy public link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    className="w-full border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                    onClick={() => openEmailNotesDialog(true)}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Email to participants
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}

          {canEdit ? (
            <section className={panelClassName}>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-[var(--ozer-accent)]" />
                <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                  Client portal
                </h2>
              </div>
              <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
                {clientId
                  ? 'When on, the linked client can open this meeting from their portal — summary, transcript, participants, and accepted tasks.'
                  : 'Link a client to this meeting to share it in their portal.'}
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <Label
                  htmlFor="meeting-portal-visible"
                  className="text-sm text-[var(--workspace-shell-text)]"
                >
                  Share to client portal
                </Label>
                <Switch
                  id="meeting-portal-visible"
                  checked={portalVisible}
                  disabled={pending || !clientId}
                  onCheckedChange={togglePortalVisible}
                />
              </div>
            </section>
          ) : null}

          {canEdit && meetingTasks.length === 0 ? (
            <section className={panelClassName}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--ozer-accent)]" />
                <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                  Tasks
                </h2>
              </div>
              <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
                Pull action items from this transcript into your workspace.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 w-full border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                onClick={() => setExtractOpen(true)}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Extract tasks
              </Button>
            </section>
          ) : null}

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

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) {
            setImportText('');
          }
        }}
      >
        <DialogContent className="max-w-xl border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <DialogHeader>
            <DialogTitle>Replace transcript</DialogTitle>
            <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
              Paste a new transcript or upload a .txt / .md / .vtt file. This
              replaces the current draft — save afterwards to keep it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label
                htmlFor="reimport-transcript"
                className="text-xs text-[var(--workspace-shell-text-muted)]"
              >
                Transcript text
              </Label>
              <Textarea
                id="reimport-transcript"
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder={`Speaker 1: Hello everyone\n\nSpeaker 2: Thanks for joining`}
                className="mt-1 min-h-[220px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] font-mono text-sm text-[var(--workspace-shell-text)]"
              />
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--ozer-accent)]">
              <Upload className="h-4 w-4" />
              Upload file
              <input
                type="file"
                accept=".txt,.md,.vtt,text/plain"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleImportFile(file);
                  }
                  event.target.value = '';
                }}
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="border-[color:var(--workspace-shell-border)]"
                onClick={() => {
                  setImportOpen(false);
                  setImportText('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                onClick={() => applyImportedTranscript(importText)}
              >
                Replace draft
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={extractOpen} onOpenChange={setExtractOpen}>
        <DialogContent className="flex max-h-[min(90dvh,calc(100dvh-2rem))] w-[min(96vw,52rem)] max-w-[min(96vw,52rem)] flex-col gap-0 overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0 text-[var(--workspace-shell-text)] sm:max-w-[min(96vw,52rem)]">
          <DialogHeader className="shrink-0 border-b border-[color:var(--workspace-shell-border)] px-6 py-4">
            <DialogTitle>Extract tasks</DialogTitle>
            <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
              AI will analyse this meeting transcript and suggest actionable
              tasks. Review and edit before adding them to the workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-5">
            {extractOpen ? (
              <ExtractWorkspaceTasksClient
                accountId={accountId}
                accountSlug={accountSlug}
                assignmentOptions={assignmentOptions}
                embedded
                initialRawText={displayContent}
                defaultClientId={clientId || transcript.clientId}
                meetingTranscriptId={transcript.id}
                meetingDateYmd={meetingDate || null}
                successRedirectHref={tasksPath}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={emailNotesOpen} onOpenChange={setEmailNotesOpen}>
        <DialogContent className="max-w-lg border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <DialogHeader>
            <DialogTitle>Email meeting notes</DialogTitle>
            <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
              Send the public meeting page link to participants. They can open
              the summary, transcript, and tasks without signing in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {participantEmailOptions.length > 0 ? (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
                {participantEmailOptions.map((email) => {
                  const checked = selectedRecipientEmails.includes(email);
                  return (
                    <label
                      key={email}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 text-sm text-[var(--workspace-shell-text)]"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          setSelectedRecipientEmails((current) =>
                            value === true
                              ? Array.from(new Set([...current, email]))
                              : current.filter((item) => item !== email),
                          );
                        }}
                      />
                      <span className="truncate">{email}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                No calendar attendees found yet. Add emails below.
              </p>
            )}

            <div>
              <Label
                htmlFor="extra-meeting-note-emails"
                className="text-xs text-[var(--workspace-shell-text-muted)]"
              >
                Add emails
              </Label>
              <Input
                id="extra-meeting-note-emails"
                value={extraRecipientEmail}
                onChange={(event) => setExtraRecipientEmail(event.target.value)}
                placeholder="name@company.com"
                className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-[color:var(--workspace-shell-border)]"
              onClick={() => setEmailNotesOpen(false)}
            >
              Not now
            </Button>
            <Button
              type="button"
              disabled={pending}
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              onClick={sendEmailNotes}
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Send emails
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
