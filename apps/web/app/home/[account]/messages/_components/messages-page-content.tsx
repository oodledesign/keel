'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from 'react';

import {
  Archive,
  Copy,
  FileText,
  ImagePlus,
  MoreHorizontal,
  Plus,
  Search,
  SendHorizontal,
  SquarePen,
  Star,
  Trash2,
  X,
  Link2,
} from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';

import { mergeChatMessagesById } from '../_lib/merge-chat-messages';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@kit/ui/avatar';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import pathsConfig from '~/config/paths.config';
import { MessageBodyText } from '~/lib/messages/message-body-text';

import type {
  ChatMessageItem,
  MessageThreadListItem,
} from '../_lib/server/messages.service';
import {
  archiveMessageThread,
  createMessageThread,
  deleteThreadMessage,
  listAttachableMessageItems,
  listMessageThreads,
  listThreadMessages,
  markMessageThreadRead,
  renameMessageThread,
  setMessageThreadJob,
  sendThreadMessage,
} from '../_lib/server/server-actions';

import { SearchableMultiSelect } from './searchable-multi-select';

const WA_INCOMING = '#202c33';
const WA_OUTGOING = '#005c4b';
const FAV_STORAGE_KEY = 'keel:favourite-chat-ids';

type PendingAttachment = {
  type: 'note' | 'doc';
  id: string;
  title: string;
  isPublic: boolean;
};

const SENDER_NAME_COLORS = [
  'text-[#53bdeb]',
  'text-[#06cf9c]',
  'text-[#ffa726]',
  'text-[#c27aff]',
  'text-[#ff8b87]',
  'text-[#7cb5ff]',
];

function senderNameColorClass(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h + userId.charCodeAt(i) * (i + 1)) % SENDER_NAME_COLORS.length;
  }
  return SENDER_NAME_COLORS[h] ?? 'text-zinc-300';
}

function senderInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase() || '?';
  }
  const one = parts[0] ?? label;
  return (one.slice(0, 2) || '?').toUpperCase();
}

function threadPrimaryTitle(
  thread: MessageThreadListItem,
  jobTitleById: Map<string, string>,
) {
  if (thread.title?.trim()) return thread.title.trim();
  if (thread.type === 'job' && thread.job_id) {
    return jobTitleById.get(thread.job_id) ?? 'Job chat';
  }
  const names = thread.participants.map((p) => p.display_name).filter(Boolean);
  return names.length ? names.join(', ') : 'Chat';
}

function threadSubtitle(thread: MessageThreadListItem) {
  const members = thread.participants.filter((p) => p.kind === 'member');
  if (thread.type === 'group' || thread.type === 'job') {
    return `${members.length} participant${members.length === 1 ? '' : 's'}`;
  }
  return null;
}

function formatShortTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d >= startOfToday) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);
  if (d >= startOfWeek) {
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatMessageTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calendarDayKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatMessageDaySeparator(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const today = startOfLocalDay(now);
  const messageDay = startOfLocalDay(d);
  const dayDiff = Math.round(
    (today.getTime() - messageDay.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff > 1 && dayDiff < 7) {
    return d.toLocaleDateString(undefined, { weekday: 'long' });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
    });
  }
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function threadCategory(thread: MessageThreadListItem): {
  label: 'Internal' | 'Client' | 'Job' | 'Job private';
  badgeClassName: string;
} {
  const hasClientParticipant = thread.participants.some((p) => p.kind === 'client');
  const memberCount = thread.participants.filter((p) => p.kind === 'member').length;

  if (thread.type === 'job') {
    if (hasClientParticipant && memberCount <= 2) {
      return {
        label: 'Job private',
        badgeClassName: 'border-[#57C87F]/40 bg-[#57C87F]/15 text-[#C7E9D0]',
      };
    }

    return {
      label: 'Job',
      badgeClassName: 'border-[#57C87F]/40 bg-[#57C87F]/15 text-[#97D9AA]',
    };
  }

  if (hasClientParticipant) {
    return {
      label: 'Client',
      badgeClassName: 'border-[#39AEB3]/45 bg-[#39AEB3]/15 text-[#7DBCBD]',
    };
  }

  return {
    label: 'Internal',
    badgeClassName: 'border-[#8D6BA5]/45 bg-[#8D6BA5]/15 text-[#DDD3E9]',
  };
}

function threadReadAccessSummary(thread: MessageThreadListItem, currentUserId: string) {
  const readableBy = thread.participants
    .filter((p) => p.kind === 'member' || p.kind === 'client')
    .map((p) => p.display_name)
    .filter(Boolean);
  const uniqueReaders = Array.from(new Set(readableBy));
  const category = threadCategory(thread).label;
  const youAreIncluded = thread.participants.some(
    (p) => p.kind === 'member' && p.user_id === currentUserId,
  );

  if (!youAreIncluded) {
    return 'You are not a participant in this thread.';
  }

  if (uniqueReaders.length === 0) {
    return `Only invited participants can read this ${category.toLowerCase()} thread.`;
  }

  const suffix =
    uniqueReaders.length > 6
      ? ` ${uniqueReaders.slice(0, 6).join(', ')} +${uniqueReaders.length - 6} more.`
      : ` ${uniqueReaders.join(', ')}.`;

  return `Only participants in this thread can read messages:${suffix}`;
}

type Props = {
  accountId: string;
  accountSlug: string;
  userId: string;
  canMessageClients: boolean;
  initialThreads: MessageThreadListItem[];
  memberOptions: Array<{ userId: string; email: string; role: string | null }>;
  clientOptions: Array<{ clientId: string; name: string; email: string | null }>;
  jobOptions: Array<{ id: string; title: string }>;
};

export function MessagesPageContent(props: Props) {
  const supabase = useSupabase();
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState(props.initialThreads);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    () => searchParams.get('thread') ?? props.initialThreads[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImagePreviewUrl, setPendingImagePreviewUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [linkJobOpen, setLinkJobOpen] = useState(false);
  const [linkJobId, setLinkJobId] = useState<string>('');
  const [listSearch, setListSearch] = useState(
    () => searchParams.get('search') ?? '',
  );

  useEffect(() => {
    const threadId = searchParams.get('thread');
    if (threadId && threads.some((thread) => thread.id === threadId)) {
      setSelectedThreadId(threadId);
    }
  }, [searchParams, threads]);

  useEffect(() => {
    const jobId = searchParams.get('threadJob');
    if (!jobId || threads.length === 0) return;

    const linked = threads.find((thread) => thread.job_id === jobId);
    if (linked) {
      setSelectedThreadId(linked.id);
      return;
    }

    setThreadType('job');
    setJobId(jobId);
    setNewChatOpen(true);
  }, [searchParams, threads]);

  useEffect(() => {
    setListSearch(searchParams.get('search') ?? '');
  }, [searchParams]);
  const [favouriteThreadIds, setFavouriteThreadIds] = useState<string[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [attachableItems, setAttachableItems] = useState<PendingAttachment[]>([]);
  const [attachLoading, setAttachLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function openAttachDialog() {
    if (!selectedThreadId) return;
    setAttachDialogOpen(true);
    setAttachLoading(true);
    try {
      const items = await listAttachableMessageItems({
        accountId: props.accountId,
        userId: props.userId,
        threadId: selectedThreadId,
      });
      setAttachableItems(
        (items ?? []).map((item) => ({
          type: item.type,
          id: item.id,
          title: item.title,
          isPublic: item.isPublic,
        })),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not load files',
      );
    } finally {
      setAttachLoading(false);
    }
  }

  function togglePendingAttachment(item: PendingAttachment) {
    setPendingAttachments((current) => {
      const exists = current.some(
        (row) => row.type === item.type && row.id === item.id,
      );
      if (exists) {
        return current.filter(
          (row) => !(row.type === item.type && row.id === item.id),
        );
      }
      if (current.length >= 5) {
        toast.error('You can attach up to 5 files per message');
        return current;
      }
      return [...current, item];
    });
  }

  const [threadType, setThreadType] = useState<'direct' | 'group' | 'job'>('direct');
  const [threadTitle, setThreadTitle] = useState('');
  const [jobId, setJobId] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  const jobTitleById = useMemo(
    () => new Map(props.jobOptions.map((j) => [j.id, j.title])),
    [props.jobOptions],
  );

  const memberMultiOptions = useMemo(
    () =>
      props.memberOptions.map((m) => ({
        value: m.userId,
        label: `${m.email} (${m.role ?? 'member'})`,
        searchText: `${m.email} ${m.role ?? ''}`,
      })),
    [props.memberOptions],
  );

  const clientMultiOptions = useMemo(
    () =>
      props.clientOptions.map((c) => ({
        value: c.clientId,
        label: c.email ? `${c.name} (${c.email})` : c.name,
        searchText: `${c.name} ${c.email ?? ''}`,
      })),
    [props.clientOptions],
  );

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  const sortedThreads = useMemo(() => {
    const favSet = new Set(favouriteThreadIds);
    return [...threads].sort((a, b) => {
      const aFav = favSet.has(a.id) ? 1 : 0;
      const bFav = favSet.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return (
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );
    });
  }, [threads, favouriteThreadIds]);

  const filteredThreads = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return sortedThreads;
    return sortedThreads.filter((t) => {
      const title = threadPrimaryTitle(t, jobTitleById).toLowerCase();
      const preview = (t.last_message_preview ?? '').toLowerCase();
      const participants = t.participants
        .map((p) => p.display_name.toLowerCase())
        .join(' ');
      const category = threadCategory(t).label.toLowerCase();
      return (
        title.includes(q) ||
        preview.includes(q) ||
        participants.includes(q) ||
        category.includes(q)
      );
    });
  }, [sortedThreads, listSearch, jobTitleById]);

  useEffect(() => {
    const raw = window.localStorage.getItem(FAV_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        setFavouriteThreadIds(parsed.filter((x): x is string => typeof x === 'string'));
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(favouriteThreadIds));
  }, [favouriteThreadIds]);

  useEffect(() => {
    return () => {
      if (pendingImagePreviewUrl) {
        URL.revokeObjectURL(pendingImagePreviewUrl);
      }
    };
  }, [pendingImagePreviewUrl]);

  const refreshThreads = useCallback(async () => {
    const result = await listMessageThreads({
      accountId: props.accountId,
      userId: props.userId,
      limit: 20,
    });
    setThreads(result ?? []);
    return result ?? [];
  }, [props.accountId, props.userId]);

  function scrollMessagesToBottom(behavior: ScrollBehavior = 'smooth') {
    const node = messageListRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      try {
        node.scrollTo({ top: node.scrollHeight, behavior });
      } catch {
        node.scrollTop = node.scrollHeight;
      }
    });
  }

  useEffect(() => {
    if (!selectedThreadId) return;
    startTransition(async () => {
      const result = await listThreadMessages({
        accountId: props.accountId,
        userId: props.userId,
        threadId: selectedThreadId,
        accountSlug: props.accountSlug,
        limit: 50,
      });
      setMessages(result ?? []);
      setHasMoreMessages((result ?? []).length >= 50);
      scrollMessagesToBottom('auto');
      await markMessageThreadRead({
        accountId: props.accountId,
        userId: props.userId,
        threadId: selectedThreadId,
      });
      await refreshThreads();
    });
  }, [selectedThreadId, props.accountId, props.userId, refreshThreads]);

  useEffect(() => {
    clearPendingImage();
    setPendingAttachments([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId) return;

    const channel = supabase
      .channel(`chat-thread-${selectedThreadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${selectedThreadId}`,
        },
        () => {
          void (async () => {
            const next = await listThreadMessages({
              accountId: props.accountId,
              userId: props.userId,
              threadId: selectedThreadId,
              accountSlug: props.accountSlug,
              limit: 50,
            });
            const incoming = next ?? [];
            setMessages((prev) => mergeChatMessagesById(prev, incoming));
            scrollMessagesToBottom('smooth');
            await refreshThreads();
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedThreadId, props.accountId, props.userId, supabase, refreshThreads]);

  // Fallback when postgres_changes is unavailable (e.g. publication not applied)
  // or Realtime is blocked; keeps thread in sync without a full page refresh.
  useEffect(() => {
    if (!selectedThreadId) return;
    let cancelled = false;
    const syncMessages = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      try {
        const next = await listThreadMessages({
          accountId: props.accountId,
          userId: props.userId,
          threadId: selectedThreadId,
          accountSlug: props.accountSlug,
          limit: 50,
        });
        if (cancelled) return;
        setMessages((prev) => mergeChatMessagesById(prev, next ?? []));
      } catch {
        /* ignore transient failures */
      }
    };
    const syncOnFocus = () => {
      void (async () => {
        await syncMessages();
        if (!cancelled) await refreshThreads();
      })();
    };
    const interval = setInterval(() => void syncMessages(), 4500);
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', syncOnFocus);
    }
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', syncOnFocus);
      }
    };
  }, [selectedThreadId, props.accountId, props.userId, refreshThreads]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-threads-${props.accountId}-${props.userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_threads',
          filter: `account_id=eq.${props.accountId}`,
        },
        () => {
          void refreshThreads();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_thread_participants',
          filter: `participant_user_id=eq.${props.userId}`,
        },
        () => {
          void refreshThreads();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [props.accountId, props.userId, supabase, refreshThreads]);

  function openNewChatDialog() {
    setThreadType('direct');
    setThreadTitle('');
    setJobId('');
    setSelectedMembers([]);
    setSelectedClients([]);
    setNewChatOpen(true);
  }

  async function onCreateThread() {
    try {
      const result = await createMessageThread({
        accountId: props.accountId,
        userId: props.userId,
        type: threadType,
        title: threadTitle || undefined,
        jobId: threadType === 'job' ? jobId || null : null,
        memberUserIds: selectedMembers,
        clientIds: selectedClients,
      });

      setThreadTitle('');
      setJobId('');
      setSelectedMembers([]);
      setSelectedClients([]);
      setNewChatOpen(false);
      const latest = await refreshThreads();
      setSelectedThreadId(result?.threadId ?? latest[0]?.id ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create chat');
    }
  }

  function clearPendingImage() {
    setPendingImageFile(null);
    if (pendingImagePreviewUrl) {
      URL.revokeObjectURL(pendingImagePreviewUrl);
    }
    setPendingImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function uploadPendingImage(threadId: string, file: File) {
    const formData = new FormData();
    formData.append('accountId', props.accountId);
    formData.append('accountSlug', props.accountSlug);
    formData.append('threadId', threadId);
    formData.append('file', file);

    const response = await fetch('/api/messages/upload-image', {
      method: 'POST',
      body: formData,
    });
    const payload = (await response.json().catch(() => ({}))) as {
      imageUrl?: string;
      error?: string;
    };

    if (!response.ok || !payload.imageUrl) {
      throw new Error(payload.error ?? 'Failed to upload image');
    }

    return payload.imageUrl;
  }

  async function onArchiveThread() {
    if (!selectedThreadId) return;
    toast.warning('This will archive the chat from your inbox.');
    const confirmed = window.confirm('Archive this chat? You can only access it again if re-added later.');
    if (!confirmed) return;
    try {
      await archiveMessageThread({
        accountId: props.accountId,
        userId: props.userId,
        threadId: selectedThreadId,
      });
      const latest = await refreshThreads();
      setSelectedThreadId(latest[0]?.id ?? null);
      setMessages([]);
      toast.success('Chat archived');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to archive chat');
    }
  }

  async function onDeleteMessage(messageId: string) {
    if (!selectedThreadId) return;
    toast.warning('This will delete the message permanently for this chat.');
    const confirmed = window.confirm('Delete this message? This cannot be undone.');
    if (!confirmed) return;
    try {
      await deleteThreadMessage({
        accountId: props.accountId,
        userId: props.userId,
        threadId: selectedThreadId,
        messageId,
      });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      await refreshThreads();
      toast.success('Message deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete message');
    }
  }

  async function onCopyMessage(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Message copied');
    } catch {
      toast.error('Could not copy message');
    }
  }

  function toggleFavouriteThread(threadId: string) {
    setFavouriteThreadIds((prev) =>
      prev.includes(threadId)
        ? prev.filter((id) => id !== threadId)
        : [...prev, threadId],
    );
  }

  async function onRenameThread() {
    if (!selectedThreadId) return;
    const current = selectedThread?.title?.trim() || '';
    const next = window.prompt('Rename chat', current);
    if (!next) return;
    try {
      await renameMessageThread({
        accountId: props.accountId,
        userId: props.userId,
        threadId: selectedThreadId,
        title: next.trim(),
      });
      await refreshThreads();
      toast.success('Chat renamed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to rename chat');
    }
  }

  function openLinkJobDialog() {
    setLinkJobId(selectedThread?.job_id ?? '');
    setLinkJobOpen(true);
  }

  async function onSetThreadJob(nextJobId: string | null) {
    if (!selectedThreadId) return;
    try {
      await setMessageThreadJob({
        accountId: props.accountId,
        userId: props.userId,
        threadId: selectedThreadId,
        jobId: nextJobId,
      });
      setLinkJobOpen(false);
      await refreshThreads();
      toast.success(nextJobId ? 'Chat linked to job' : 'Job link removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update job link');
    }
  }

  async function onSendMessage() {
    if (!selectedThreadId) return;
    const hasText = Boolean(messageInput.trim());
    const hasImage = Boolean(pendingImageFile);
    const hasAttachments = pendingAttachments.length > 0;
    if (!hasText && !hasImage && !hasAttachments) return;
    const text = messageInput;
    const imageFile = pendingImageFile;
    const attachments = pendingAttachments;
    setMessageInput('');

    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        imageUrl = await uploadPendingImage(selectedThreadId, imageFile);
      }

      const result = await sendThreadMessage({
        accountId: props.accountId,
        userId: props.userId,
        threadId: selectedThreadId,
        body: text,
        accountSlug: props.accountSlug,
        imageUrl,
        attachments: attachments.map(({ type, id, title }) => ({
          type,
          id,
          title,
        })),
      });

      if (result) {
        setMessages((prev) =>
          mergeChatMessagesById(prev, [result as ChatMessageItem]),
        );
      } else {
        const next = await listThreadMessages({
          accountId: props.accountId,
          userId: props.userId,
          threadId: selectedThreadId,
          accountSlug: props.accountSlug,
          limit: 50,
        });
        setMessages((prev) => mergeChatMessagesById(prev, next ?? []));
      }
      scrollMessagesToBottom('smooth');
      clearPendingImage();
      setPendingAttachments([]);
      await refreshThreads();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
      setMessageInput(text);
    }
  }

  async function onLoadOlderMessages() {
    if (!selectedThreadId || messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest) return;
    const result = await listThreadMessages({
      accountId: props.accountId,
      userId: props.userId,
      threadId: selectedThreadId,
      accountSlug: props.accountSlug,
      limit: 50,
      before: oldest.created_at,
    });

    if (!result || result.length === 0) {
      setHasMoreMessages(false);
      return;
    }

    setMessages((prev) => [...result, ...prev]);
    setHasMoreMessages(result.length >= 50);
  }

  const chatSurfaceStyle: CSSProperties = {
    backgroundColor: '#0b141a',
    backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)`,
    backgroundSize: '24px 24px',
  };
  const canSend = Boolean(
    selectedThreadId &&
      (messageInput.trim() || pendingImageFile || pendingAttachments.length > 0),
  );

  return (
    <div className="flex min-h-[min(720px,calc(100dvh-10rem))] flex-col overflow-hidden rounded-xl border border-white/10 bg-[var(--workspace-shell-panel)] md:flex-row">
      {/* Sidebar — chat list */}
      <aside className="flex w-full shrink-0 flex-col border-white/10 md:w-[min(100%,380px)] md:border-r">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-3">
          <h2 className="text-lg font-semibold tracking-tight text-white">Chats</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-zinc-300 hover:bg-white/10 hover:text-white"
            aria-label="New chat"
            onClick={openNewChatDialog}
          >
            <SquarePen className="h-5 w-5" />
          </Button>
        </div>
        <div className="border-b border-white/10 px-2 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-zinc-300" />
            <Input
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search or start new chat"
              className="h-9 border-white/10 bg-black/25 pl-9 text-sm placeholder:text-zinc-500"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredThreads.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-300">
              {threads.length === 0
                ? 'No conversations yet. Start a new chat.'
                : 'No matches.'}
            </p>
          ) : (
            filteredThreads.map((thread) => {
              const title = threadPrimaryTitle(thread, jobTitleById);
              const initials = senderInitials(title);
              const timeLabel = formatShortTime(thread.last_message_at);
              const category = threadCategory(thread);
              const isFavourite = favouriteThreadIds.includes(thread.id);
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`flex w-full gap-3 border-b border-white/[0.06] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04] ${
                    selectedThreadId === thread.id ? 'bg-white/[0.06]' : ''
                  }`}
                >
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarFallback className="bg-tw-surface-700 text-sm font-medium text-zinc-200">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {isFavourite ? (
                          <Star className="h-3.5 w-3.5 shrink-0 text-[#F2C94C]" />
                        ) : null}
                        <p className="truncate font-medium text-zinc-100">{title}</p>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${category.badgeClassName}`}
                        >
                          {category.label}
                        </span>
                      </div>
                      <span className="shrink-0 text-[11px] text-zinc-300">{timeLabel}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-sm text-zinc-300">
                        {thread.last_message_preview ?? 'No messages yet'}
                      </p>
                      {thread.unread_count > 0 ? (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-green-500)] px-1 text-[11px] font-semibold text-black">
                          {thread.unread_count > 99 ? '99+' : thread.unread_count}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main conversation */}
      <section className="flex min-h-[50vh] min-w-0 flex-1 flex-col md:min-h-0">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#1f2c34] px-4 py-2.5">
          {selectedThread ? (
            <>
              <Avatar className="h-10 w-10 shrink-0 md:hidden">
                <AvatarFallback className="bg-tw-surface-600 text-sm text-zinc-100">
                  {senderInitials(threadPrimaryTitle(selectedThread, jobTitleById))}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-medium text-zinc-100">
                  {threadPrimaryTitle(selectedThread, jobTitleById)}
                </h2>
                {threadSubtitle(selectedThread) ? (
                  <p className="truncate text-xs text-zinc-300">
                    {threadSubtitle(selectedThread)}
                  </p>
                ) : null}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-zinc-300 hover:bg-white/10 hover:text-white"
                    aria-label="Chat options"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {selectedThread.job_id ? (
                    <DropdownMenuItem asChild>
                      <Link
                        href={pathsConfig.app.accountJobDetail
                          .replace('[account]', props.accountSlug)
                          .replace('[id]', selectedThread.job_id!)}
                      >
                        Open job
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onClick={() => void onRenameThread()}>
                    Rename chat
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openLinkJobDialog}>
                    <Link2 className="mr-2 h-4 w-4" />
                    {selectedThread.job_id ? 'Change job link' : 'Link to job'}
                  </DropdownMenuItem>
                  {selectedThread.job_id ? (
                    <DropdownMenuItem
                      onClick={() => void onSetThreadJob(null)}
                      className="text-zinc-300"
                    >
                      Unlink from job
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    onClick={() => toggleFavouriteThread(selectedThread.id)}
                  >
                    <Star className="mr-2 h-4 w-4" />
                    {favouriteThreadIds.includes(selectedThread.id)
                      ? 'Unfavourite chat'
                      : 'Favourite chat'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void onArchiveThread()}
                    className="text-amber-500"
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive chat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <p className="text-sm text-zinc-300">Select a chat to start messaging</p>
          )}
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="absolute inset-0" style={chatSurfaceStyle} aria-hidden />
          <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
            {selectedThread ? (
              <div className="border-b border-white/10 bg-[#0f1a22] px-4 py-2">
                <p className="text-xs text-[#AAB4C8]">
                  {threadReadAccessSummary(selectedThread, props.userId)}
                </p>
              </div>
            ) : null}
            <div
              ref={messageListRef}
              className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-3 md:px-6 md:py-4"
            >
              {!selectedThreadId ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                  <p className="text-sm text-zinc-300">Choose a conversation from the list</p>
                  <Button variant="outline" size="sm" onClick={openNewChatDialog}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    New chat
                  </Button>
                </div>
              ) : null}
              {selectedThreadId && hasMoreMessages ? (
                <div className="flex justify-center pb-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-black/40 text-zinc-200 hover:bg-black/50"
                    onClick={() => void onLoadOlderMessages()}
                  >
                    Load older messages
                  </Button>
                </div>
              ) : null}
              {selectedThreadId
                ? messages.map((message, index) => {
                    const isOwn = message.sender_user_id === props.userId;
                    const prev = messages[index - 1];
                    const showDaySeparator =
                      !prev ||
                      calendarDayKey(prev.created_at) !==
                        calendarDayKey(message.created_at);
                    const isGroupLike =
                      selectedThread?.type === 'group' || selectedThread?.type === 'job';
                    const showSenderName =
                      isGroupLike &&
                      !isOwn &&
                      (!prev || prev.sender_user_id !== message.sender_user_id);
                    const label = message.sender_label ?? 'Someone';
                    const initials = senderInitials(label);

                    return (
                      <Fragment key={message.id}>
                        {showDaySeparator ? (
                          <div className="flex justify-center py-3">
                            <span className="rounded-full bg-[#18242c]/95 px-3 py-1 text-[11px] font-medium text-[#AAB4C8] shadow-sm ring-1 ring-white/5">
                              {formatMessageDaySeparator(message.created_at)}
                            </span>
                          </div>
                        ) : null}
                        <div
                          className={`group flex gap-2 px-0.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${
                            showSenderName ? 'mt-3' : 'mt-0.5'
                          }`}
                        >
                        <Avatar className="mt-auto mb-0.5 h-8 w-8 shrink-0">
                          <AvatarImage
                            src={message.sender_avatar_url ?? undefined}
                            alt={label}
                          />
                          <AvatarFallback className="bg-tw-surface-700 text-[10px] font-medium text-zinc-200">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={`flex min-w-0 max-w-[min(85%,32rem)] flex-col ${
                            isOwn ? 'items-end' : 'items-start'
                          }`}
                        >
                          {showSenderName ? (
                            <span className="mb-0.5 flex max-w-full items-center gap-1.5 px-0.5">
                              <span
                                className={`shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wide ${senderNameColorClass(message.sender_user_id)}`}
                                aria-hidden="true"
                              >
                                {initials}
                              </span>
                              <span
                                className={`truncate text-[13px] font-medium ${senderNameColorClass(message.sender_user_id)}`}
                              >
                                {label}
                              </span>
                            </span>
                          ) : null}
                          <div
                            className={`rounded-lg px-2 py-1.5 pr-2 pb-1 text-sm shadow-sm ${
                              isOwn
                                ? 'rounded-br-none text-white'
                                : 'rounded-bl-none text-zinc-100'
                            }`}
                            style={{
                              backgroundColor: isOwn ? WA_OUTGOING : WA_INCOMING,
                            }}
                          >
                            {message.image_url ? (
                              <img
                                src={message.image_url}
                                alt="Message attachment"
                                className="mb-1.5 max-h-72 w-full rounded-md object-contain"
                              />
                            ) : null}
                            {message.body ? (
                              <MessageBodyText
                                text={message.body}
                                linkClassName={
                                  isOwn
                                    ? 'text-emerald-50 hover:text-white'
                                    : 'text-sky-200 hover:text-sky-100'
                                }
                              />
                            ) : null}
                            {message.attachments?.length ? (
                              <div className="mt-1.5 space-y-1">
                                {message.attachments.map((attachment) => (
                                  <div
                                    key={`${attachment.type}-${attachment.id}`}
                                    className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5"
                                  >
                                    {attachment.href ? (
                                      <a
                                        href={attachment.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-center gap-2 text-sm underline-offset-2 hover:underline ${
                                          isOwn
                                            ? 'text-emerald-50'
                                            : 'text-sky-200'
                                        }`}
                                      >
                                        <FileText className="h-4 w-4 shrink-0" />
                                        <span className="truncate">
                                          {attachment.title}
                                        </span>
                                      </a>
                                    ) : (
                                      <div className="flex items-center gap-2 text-sm text-zinc-200">
                                        <FileText className="h-4 w-4 shrink-0" />
                                        <span className="truncate">
                                          {attachment.title}
                                        </span>
                                      </div>
                                    )}
                                    {attachment.isPublic ? (
                                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                                        Public link
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            <div
                              className={`mt-0.5 flex items-end justify-end gap-1 text-[11px] ${
                                isOwn ? 'text-emerald-100/80' : 'text-zinc-300'
                              }`}
                            >
                              <span>{formatMessageTime(message.created_at)}</span>
                            </div>
                          </div>
                          <div className="mt-1 flex w-full justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="rounded p-1 text-zinc-300 opacity-0 transition-opacity hover:bg-white/10 hover:text-zinc-100 group-hover:opacity-100"
                                  aria-label="Message options"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align={isOwn ? 'end' : 'start'}
                                className="w-40"
                              >
                                <DropdownMenuItem
                                  onClick={() =>
                                    void onCopyMessage(
                                      [message.body, message.image_url]
                                        .filter(Boolean)
                                        .join('\n'),
                                    )
                                  }
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copy
                                </DropdownMenuItem>
                                {isOwn ? (
                                  <DropdownMenuItem
                                    onClick={() => void onDeleteMessage(message.id)}
                                    className="text-red-500"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        </div>
                      </Fragment>
                    );
                  })
                : null}
            </div>

            {/* Composer — pill bar */}
            <div className="relative z-[1] border-t border-white/10 bg-[#1f2c34] px-3 py-2 md:px-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!file.type.startsWith('image/')) {
                    toast.error('Please select an image file');
                    return;
                  }
                  if (file.size > 10 * 1024 * 1024) {
                    toast.error('Image is too large (max 10MB)');
                    return;
                  }
                  clearPendingImage();
                  const objectUrl = URL.createObjectURL(file);
                  setPendingImageFile(file);
                  setPendingImagePreviewUrl(objectUrl);
                }}
              />
              {pendingAttachments.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingAttachments.map((attachment) => (
                    <div
                      key={`${attachment.type}-${attachment.id}`}
                      className="flex items-center gap-1 rounded-full border border-white/10 bg-black/25 px-2 py-1 text-xs text-zinc-200"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span className="max-w-[12rem] truncate">
                        {attachment.title}
                      </span>
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-white/10"
                        onClick={() => togglePendingAttachment(attachment)}
                        aria-label={`Remove ${attachment.title}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {pendingImagePreviewUrl ? (
                <div className="mb-2 flex items-start gap-2 rounded-lg border border-white/10 bg-black/25 p-2">
                  <img
                    src={pendingImagePreviewUrl}
                    alt="Attachment preview"
                    className="h-16 w-16 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-zinc-300">
                      {pendingImageFile?.name ?? 'Image'}
                    </p>
                    <p className="text-[11px] text-zinc-300">
                      {pendingImageFile
                        ? `${Math.round(pendingImageFile.size / 1024)} KB`
                        : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-zinc-300 hover:bg-white/10 hover:text-zinc-100"
                    onClick={clearPendingImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-zinc-300 hover:bg-white/10 hover:text-zinc-200"
                  aria-label="Link note or file"
                  disabled={!selectedThreadId}
                  onClick={() => void openAttachDialog()}
                >
                  <Link2 className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-zinc-300 hover:bg-white/10 hover:text-zinc-200"
                  aria-label="Attach image"
                  disabled={!selectedThreadId}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-5 w-5" />
                </Button>
                <Textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={
                    selectedThreadId ? 'Type a message' : 'Select a chat first'
                  }
                  disabled={!selectedThreadId}
                  rows={1}
                  className="max-h-32 min-h-10 flex-1 resize-none rounded-3xl border-white/12 bg-[#2a3942] py-2.5 pr-3 pl-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-[var(--brand-green-500)]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void onSendMessage();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  className={`h-10 w-10 shrink-0 rounded-full transition-colors ${
                    canSend ? 'text-black' : 'text-zinc-300'
                  }`}
                  style={{
                    backgroundColor: canSend ? '#57C87F' : '#243549',
                  }}
                  disabled={isPending || !canSend}
                  aria-label="Send"
                  onClick={() => void onSendMessage()}
                >
                  <SendHorizontal className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={attachDialogOpen} onOpenChange={setAttachDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto border-white/10 bg-[#1f2c34] text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link note or file</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Only notes and files this recipient can view are shown — public
            items or those linked to clients on the chat.
          </p>
          {attachLoading ? (
            <p className="py-6 text-sm text-zinc-400">Loading…</p>
          ) : attachableItems.length === 0 ? (
            <p className="py-6 text-sm text-zinc-400">
              No shareable notes or files yet. Upload files in Notes and files,
              or turn on public sharing for a link anyone can open.
            </p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto pt-2">
              {attachableItems.map((item) => {
                const selected = pendingAttachments.some(
                  (row) => row.type === item.type && row.id === item.id,
                );
                return (
                  <li key={`${item.type}-${item.id}`}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        selected
                          ? 'bg-emerald-900/40 text-emerald-100'
                          : 'hover:bg-white/5 text-zinc-100'
                      }`}
                      onClick={() => togglePendingAttachment(item)}
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      <span className="shrink-0 text-[10px] uppercase text-zinc-400">
                        {item.type === 'note' ? 'Note' : 'File'}
                        {item.isPublic ? ' · Public' : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAttachDialogOpen(false)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#1f2c34] text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Type</Label>
              <Select
                value={threadType}
                onValueChange={(v) => setThreadType(v as 'direct' | 'group' | 'job')}
              >
                <SelectTrigger className="border-white/12 bg-black/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                  <SelectItem value="job">Job thread</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-chat-title" className="text-zinc-300">
                Title (optional)
              </Label>
              <Input
                id="new-chat-title"
                value={threadTitle}
                onChange={(e) => setThreadTitle(e.target.value)}
                placeholder="Chat name"
                className="border-white/12 bg-black/30"
              />
            </div>
            {threadType === 'job' ? (
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Job</Label>
                {props.jobOptions.length > 0 ? (
                  <Select value={jobId || undefined} onValueChange={setJobId}>
                    <SelectTrigger className="border-white/12 bg-black/30">
                      <SelectValue placeholder="Select a job" />
                    </SelectTrigger>
                    <SelectContent>
                      {props.jobOptions.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={jobId}
                    onChange={(e) => setJobId(e.target.value)}
                    placeholder="Job ID"
                    className="border-white/12 bg-black/30"
                  />
                )}
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="new-chat-members" className="text-zinc-300">
                Team members
              </Label>
              <SearchableMultiSelect
                id="new-chat-members"
                options={memberMultiOptions}
                values={selectedMembers}
                onValuesChange={setSelectedMembers}
                placeholder="Select team members…"
                searchPlaceholder="Search by email or role…"
                emptyMessage="No team members match."
              />
            </div>
            {props.canMessageClients ? (
              <div className="space-y-1.5">
                <Label htmlFor="new-chat-clients" className="text-zinc-300">
                  Clients
                </Label>
                <SearchableMultiSelect
                  id="new-chat-clients"
                  options={clientMultiOptions}
                  values={selectedClients}
                  onValuesChange={setSelectedClients}
                  placeholder="Select clients…"
                  searchPlaceholder="Search by name or email…"
                  emptyMessage="No clients match."
                />
              </div>
            ) : null}
            <Button
              type="button"
              className="w-full border-0 bg-[#57C87F] font-medium text-[#060C18] hover:bg-[#97D9AA] hover:text-[#060C18] disabled:opacity-50"
              onClick={() => void onCreateThread()}
              disabled={isPending}
            >
              Create chat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={linkJobOpen} onOpenChange={setLinkJobOpen}>
        <DialogContent className="border-white/10 bg-[#1f2c34] text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link chat to job</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-zinc-300">
              Linking makes this chat appear in that job&apos;s Messages tab for participants.
            </p>
            <Select value={linkJobId || undefined} onValueChange={setLinkJobId}>
              <SelectTrigger className="border-white/12 bg-black/30">
                <SelectValue placeholder="Select a job" />
              </SelectTrigger>
              <SelectContent>
                {props.jobOptions.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/15 bg-transparent"
                onClick={() => setLinkJobOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-[var(--brand-green-500)] text-black hover:bg-[var(--brand-green-300)]"
                disabled={!linkJobId}
                onClick={() => void onSetThreadJob(linkJobId || null)}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
