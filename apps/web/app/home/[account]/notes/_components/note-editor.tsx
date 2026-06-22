'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  ChevronLeft,
  FolderKanban,
  Globe,
  Link2,
  Pin,
  Share2,
  Tag,
  Users,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@kit/ui/popover';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

import { CategorySelect } from '../../_components/workspace-content/category-select';
import { LinkToSelect, type LinkValue } from '../../_components/workspace-content/link-to-select';
import { PublicSharingSection } from '../../_components/workspace-content/public-sharing-section';
import { TagsInput } from '../../_components/workspace-content/tags-input';
import type {
  CustomNoteCategory,
  LinkOption,
  NoteFileCategory,
} from '../../_lib/workspace-content/types';
import {
  saveWorkspaceNoteAction,
  syncWorkspaceNoteBrainIndexAction,
} from '../../_lib/workspace-content/notes-actions';
import { useFormFieldScrollPassthroughRefs } from '~/lib/scroll-passthrough';

import { NoteMarkdownToolbar } from './note-markdown-toolbar';

type NoteEditorProps = {
  accountId: string;
  accountSlug: string;
  linkOptions: LinkOption[];
  customCategories?: CustomNoteCategory[];
  notesListHref?: string;
  personalScope?: boolean;
  note: {
    id: string;
    title: string;
    content: string;
    isPinned: boolean;
    category: NoteFileCategory;
    tags: string[];
    isPublic: boolean;
    jobId?: string | null;
    clientId?: string | null;
    propertyId?: string | null;
    projectName: string | null;
    clientName: string | null;
  };
};

function linkFromNote(note: NoteEditorProps['note']): LinkValue {
  if (note.jobId) return { type: 'job', id: note.jobId };
  if (note.clientId) return { type: 'client', id: note.clientId };
  if (note.propertyId) return { type: 'property', id: note.propertyId };
  return null;
}

export function NoteEditor({
  accountId,
  accountSlug,
  linkOptions,
  customCategories: initialCustomCategories = [],
  notesListHref,
  personalScope,
  note,
}: NoteEditorProps) {
  const router = useRouter();
  const notesHref =
    notesListHref ??
    pathsConfig.app.accountNotes.replace('[account]', accountSlug);

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isPinned, setIsPinned] = useState(note.isPinned);
  const [category, setCategory] = useState(note.category);
  const [tags, setTags] = useState(note.tags);
  const [link, setLink] = useState<LinkValue>(linkFromNote(note));
  const [customCategories, setCustomCategories] = useState(initialCustomCategories);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brainIndexTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);
  const leavingRef = useRef(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const latestRef = useRef({
    title,
    content,
    isPinned,
    category,
    tags,
    link,
  });

  useEffect(() => {
    latestRef.current = { title, content, isPinned, category, tags, link };
  }, [title, content, isPinned, category, tags, link]);

  useEffect(() => {
    setCustomCategories(initialCustomCategories);
  }, [initialCustomCategories]);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setIsPinned(note.isPinned);
    setCategory(note.category);
    setTags(note.tags);
    setLink(linkFromNote(note));
    isDirtyRef.current = false;
  }, [note.id]);

  const scheduleBrainIndex = useCallback(() => {
    if (brainIndexTimerRef.current) clearTimeout(brainIndexTimerRef.current);
    brainIndexTimerRef.current = setTimeout(() => {
      void syncWorkspaceNoteBrainIndexAction({
        accountId,
        noteId: note.id,
      });
    }, 45_000);
  }, [accountId, note.id]);

  const persist = useCallback(async () => {
    const snapshot = latestRef.current;

    setSaveState('saving');
    try {
      await saveWorkspaceNoteAction({
        accountId,
        accountSlug,
        noteId: note.id,
        title: snapshot.title.trim(),
        content: snapshot.content,
        isPinned: snapshot.isPinned,
        category: snapshot.category,
        tags: snapshot.tags,
        link: snapshot.link,
        personalScope,
      });
      setSaveState('saved');
      isDirtyRef.current = false;
      scheduleBrainIndex();
    } catch {
      setSaveState('error');
      toast.error('Could not save note');
    }
  }, [accountId, accountSlug, note.id, personalScope, scheduleBrainIndex]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist();
    }, 900);
  }, [persist]);

  const flushBrainIndex = useCallback(() => {
    const hadPendingBrainIndex = brainIndexTimerRef.current != null;
    if (brainIndexTimerRef.current) {
      clearTimeout(brainIndexTimerRef.current);
      brainIndexTimerRef.current = null;
    }
    if (hadPendingBrainIndex) {
      void syncWorkspaceNoteBrainIndexAction({
        accountId,
        noteId: note.id,
      });
    }
  }, [accountId, note.id]);

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!isDirtyRef.current) return;

    const snapshot = latestRef.current;
    await saveWorkspaceNoteAction({
      accountId,
      accountSlug,
      noteId: note.id,
      title: snapshot.title.trim(),
      content: snapshot.content,
      isPinned: snapshot.isPinned,
      category: snapshot.category,
      tags: snapshot.tags,
      link: snapshot.link,
      personalScope,
    });
    isDirtyRef.current = false;
  }, [accountId, accountSlug, note.id, personalScope]);

  const goBackToList = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;

    try {
      await flushPendingSave();
    } catch {
      toast.error('Could not save note');
      leavingRef.current = false;
      return;
    }

    flushBrainIndex();
    router.push(notesHref);
    router.refresh();
  }, [flushBrainIndex, flushPendingSave, notesHref, router]);

  useEffect(() => {
    return () => {
      if (leavingRef.current) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      if (isDirtyRef.current) {
        void saveWorkspaceNoteAction({
          accountId,
          accountSlug,
          noteId: note.id,
          title: latestRef.current.title.trim(),
          content: latestRef.current.content,
          isPinned: latestRef.current.isPinned,
          category: latestRef.current.category,
          tags: latestRef.current.tags,
          link: latestRef.current.link,
          personalScope,
        });
      }

      flushBrainIndex();
    };
  }, [accountId, accountSlug, flushBrainIndex, note.id, personalScope]);

  const syncTextareaHeight = useCallback((node: HTMLTextAreaElement | null) => {
    if (!node) return;

    const scrollY = window.scrollY;
    const previousHeight = node.offsetHeight;

    node.style.height = 'auto';
    const nextHeight = Math.max(node.scrollHeight, previousHeight);
    node.style.height = `${nextHeight}px`;

    window.scrollTo(0, scrollY);
  }, []);

  useLayoutEffect(() => {
    syncTextareaHeight(titleRef.current);
  }, [title, syncTextareaHeight]);

  useFormFieldScrollPassthroughRefs(
    () => [titleRef.current, textareaRef.current],
    [title, content],
  );

  const onTitleChange = (value: string) => {
    isDirtyRef.current = true;
    setTitle(value);
    setSaveState('idle');
    scheduleSave();
    requestAnimationFrame(() => syncTextareaHeight(titleRef.current));
  };

  const onContentChange = (value: string) => {
    isDirtyRef.current = true;
    setContent(value);
    setSaveState('idle');
    scheduleSave();
    requestAnimationFrame(() => syncTextareaHeight(textareaRef.current));
  };

  const onTitleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    textareaRef.current?.focus();
  };

  const onMetaChange = <T,>(setter: (value: T) => void, value: T) => {
    isDirtyRef.current = true;
    setter(value);
    setSaveState('idle');
    scheduleSave();
  };

  const toolbarBtn = (active?: boolean) =>
    cn(
      'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
      active
        ? 'bg-[#2A9D8F]/20 text-[#5eead4]'
        : 'text-zinc-400 hover:bg-white/6 hover:text-white',
    );

  const saveLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Saved'
        : saveState === 'error'
          ? 'Save failed'
          : ' ';

  const noteDetailPath = personalScope
    ? pathsConfig.app.personalNoteDetail.replace('[noteId]', note.id)
    : pathsConfig.app.accountNoteDetail
        .replace('[account]', accountSlug)
        .replace('[noteId]', note.id);

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-white/8 bg-[var(--workspace-shell-canvas)] px-4 py-2 sm:px-6 lg:px-10 xl:px-14">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 shrink-0 p-0 text-zinc-300 hover:bg-white/6 hover:text-white"
            aria-label="Back to notes"
            onClick={() => void goBackToList()}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span
            className={cn(
              'min-w-[4.5rem] truncate text-xs',
              saveState === 'error' ? 'text-red-400' : 'text-zinc-500',
            )}
            aria-live="polite"
          >
            {saveLabel}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={toolbarBtn()} aria-label="Category">
                <FolderKanban className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-72 border-white/10 bg-[var(--workspace-shell-panel)] text-white"
            >
              <CategorySelect
                value={category}
                onChange={(value) => onMetaChange(setCategory, value)}
                accountId={accountId}
                accountSlug={accountSlug}
                customCategories={customCategories}
                personalScope={personalScope}
                onCustomCategoryCreated={(created) => {
                  setCustomCategories((prev) => {
                    if (prev.some((c) => c.slug === created.slug)) return prev;
                    return [...prev, created].sort((a, b) =>
                      a.label.localeCompare(b.label),
                    );
                  });
                }}
              />
            </PopoverContent>
          </Popover>

          {linkOptions.length > 0 ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={toolbarBtn(Boolean(link))}
                  aria-label="Link to project or client"
                >
                  <Link2 className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-80 border-white/10 bg-[var(--workspace-shell-panel)] text-white"
              >
                <LinkToSelect
                  options={linkOptions}
                  value={link}
                  onChange={(value) => onMetaChange(setLink, value)}
                />
              </PopoverContent>
            </Popover>
          ) : null}

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={toolbarBtn(tags.length > 0)}
                aria-label="Tags"
              >
                <Tag className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-80 border-white/10 bg-[var(--workspace-shell-panel)] text-white"
            >
              <TagsInput
                tags={tags}
                onChange={(value) => onMetaChange(setTags, value)}
              />
            </PopoverContent>
          </Popover>

          <button
            type="button"
            className={toolbarBtn(isPinned)}
            aria-label={isPinned ? 'Unpin note' : 'Pin note'}
            onClick={() => onMetaChange(setIsPinned, !isPinned)}
          >
            <Pin className="h-4 w-4" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={toolbarBtn()} aria-label="Share">
                <Share2 className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-72 border-white/10 bg-[var(--workspace-shell-panel)] text-white"
            >
              <div className="p-2">
                <PublicSharingSection
                  accountId={accountId}
                  accountSlug={accountSlug}
                  itemType="note"
                  itemId={note.id}
                  isPublic={note.isPublic}
                />
              </div>
              {note.clientName ? (
                <DropdownMenuItem disabled className="text-zinc-400">
                  <Users className="mr-2 h-4 w-4" />
                  Client: {note.clientName}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={() => {
                  const url = `${window.location.origin}${noteDetailPath}`;
                  void navigator.clipboard.writeText(url);
                  toast.success('Link copied');
                }}
              >
                <Users className="mr-2 h-4 w-4" />
                Copy link
              </DropdownMenuItem>
              {note.isPublic ? (
                <DropdownMenuItem disabled className="text-[#5eead4]">
                  <Globe className="mr-2 h-4 w-4" />
                  Live link enabled
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {(note.projectName || note.clientName) && (
        <p className="px-4 pt-2 text-xs text-zinc-500 sm:px-6 lg:px-10 xl:px-14">
          {[note.projectName, note.clientName].filter(Boolean).join(' · ')}
        </p>
      )}

      <Textarea
        ref={titleRef}
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        onKeyDown={onTitleKeyDown}
        placeholder="Untitled"
        rows={1}
        aria-label="Note title"
        className="w-full resize-none overflow-hidden rounded-none border-0 bg-transparent px-4 pb-2 pt-4 font-heading text-[1.75rem] font-bold leading-tight tracking-tight text-white shadow-none focus-visible:ring-0 touch-pan-y sm:px-6 lg:px-10 lg:text-3xl xl:px-14"
        spellCheck
      />

      <NoteMarkdownToolbar
        textareaRef={textareaRef}
        onChange={onContentChange}
        className="px-4 sm:px-6 lg:px-10 xl:px-14"
      />

      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="Start writing…"
        rows={12}
        aria-label="Note content"
        className="min-h-[50vh] w-full resize-none overflow-hidden rounded-none border-0 bg-transparent px-4 pb-4 pt-1 text-base leading-relaxed text-white shadow-none focus-visible:ring-0 touch-pan-y sm:px-6 lg:px-10 lg:text-[15px] xl:px-14"
        spellCheck
      />
    </div>
  );
}
