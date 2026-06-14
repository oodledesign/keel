'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';
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
  LinkOption,
  NoteFileCategory,
} from '../../_lib/workspace-content/types';
import { saveWorkspaceNoteAction } from '../../_lib/workspace-content/notes-actions';

type NoteEditorProps = {
  accountId: string;
  accountSlug: string;
  linkOptions: LinkOption[];
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

function splitTitleBody(fullText: string): { title: string; content: string } {
  const normalized = fullText.replace(/\r\n/g, '\n');
  const firstNewline = normalized.indexOf('\n');
  if (firstNewline === -1) {
    return { title: normalized.trim(), content: '' };
  }
  const title = normalized.slice(0, firstNewline).trim();
  const content = normalized.slice(firstNewline + 1);
  return { title, content };
}

function combineTitleBody(title: string, content: string): string {
  if (!title.trim()) return content;
  if (!content.trim()) return title;
  return `${title}\n${content}`;
}

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
  note,
}: NoteEditorProps) {
  const router = useRouter();
  const notesHref = pathsConfig.app.accountNotes.replace('[account]', accountSlug);

  const initialBody = useMemo(
    () => combineTitleBody(note.title, note.content),
    [note.title, note.content],
  );

  const [body, setBody] = useState(initialBody);
  const [isPinned, setIsPinned] = useState(note.isPinned);
  const [category, setCategory] = useState(note.category);
  const [tags, setTags] = useState(note.tags);
  const [link, setLink] = useState<LinkValue>(linkFromNote(note));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({
    body,
    isPinned,
    category,
    tags,
    link,
  });

  useEffect(() => {
    latestRef.current = { body, isPinned, category, tags, link };
  }, [body, isPinned, category, tags, link]);

  useEffect(() => {
    setBody(initialBody);
    setIsPinned(note.isPinned);
    setCategory(note.category);
    setTags(note.tags);
    setLink(linkFromNote(note));
  }, [initialBody, note]);

  const persist = useCallback(async () => {
    const snapshot = latestRef.current;
    const { title, content } = splitTitleBody(snapshot.body);

    setSaveState('saving');
    try {
      await saveWorkspaceNoteAction({
        accountId,
        accountSlug,
        noteId: note.id,
        title,
        content,
        isPinned: snapshot.isPinned,
        category: snapshot.category,
        tags: snapshot.tags,
        link: snapshot.link,
      });
      setSaveState('saved');
      router.refresh();
    } catch {
      setSaveState('error');
      toast.error('Could not save note');
    }
  }, [accountId, accountSlug, note.id, router]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist();
    }, 900);
  }, [persist]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const onBodyChange = (value: string) => {
    setBody(value);
    setSaveState('idle');
    scheduleSave();
  };

  const onMetaChange = <T,>(setter: (value: T) => void, value: T) => {
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
          : '';

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col lg:min-h-[calc(100vh-8rem)]">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-white/8 bg-[var(--workspace-shell-canvas)] px-3 py-2 lg:px-0">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            asChild
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 shrink-0 p-0 text-zinc-300 hover:bg-white/6 hover:text-white"
          >
            <Link href={notesHref} aria-label="Back to notes">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          {saveLabel ? (
            <span
              className={cn(
                'truncate text-xs',
                saveState === 'error' ? 'text-red-400' : 'text-zinc-500',
              )}
            >
              {saveLabel}
            </span>
          ) : null}
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
                  const url = `${window.location.origin}${pathsConfig.app.accountNoteDetail.replace('[account]', accountSlug).replace('[noteId]', note.id)}`;
                  void navigator.clipboard.writeText(url);
                  toast.success('Team link copied');
                }}
              >
                <Users className="mr-2 h-4 w-4" />
                Copy link for team
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
        <p className="px-3 pt-2 text-xs text-zinc-500 lg:px-0">
          {[note.projectName, note.clientName].filter(Boolean).join(' · ')}
        </p>
      )}

      <Textarea
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder="Title on the first line…"
        className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-3 py-4 text-base leading-relaxed text-white shadow-none focus-visible:ring-0 lg:px-0 lg:text-[15px]"
        spellCheck
      />
    </div>
  );
}
