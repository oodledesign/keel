'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { toast } from '@kit/ui/sonner';

import {
  type ContentPost,
  type PeriodKind,
  type PeriodNote,
  indexNotes,
  monthStart,
  weekStart,
} from '~/lib/projects/content/content-calendar';

import { getErrorMessage } from '../../../_lib/error-message';
import {
  deleteContentPost,
  loadProjectContent,
  saveContentPost,
  savePeriodNote,
} from '../../../_lib/server/project-content.actions';

export type ContentPostDraft = Omit<ContentPost, 'id'> & { id?: string };

/** Posts and week / month notes for one project, with instant local updates. */
export function useProjectContent({
  accountId,
  jobId,
}: {
  accountId: string;
  jobId: string;
}) {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [notes, setNotes] = useState<PeriodNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    try {
      const result = await loadProjectContent({ accountId, jobId });
      if (!mounted.current) return;
      setPosts(result.posts);
      setNotes(result.notes);
      setFailed(false);
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [accountId, jobId]);

  useEffect(() => {
    mounted.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  const savePost = useCallback(
    async (draft: ContentPostDraft) => {
      const previous = posts;
      const tempId = draft.id ?? `temp-${crypto.randomUUID()}`;
      const optimistic: ContentPost = { ...draft, id: tempId };

      setPosts((current) =>
        draft.id
          ? current.map((post) => (post.id === draft.id ? optimistic : post))
          : [...current, optimistic],
      );

      try {
        const saved = await saveContentPost({
          accountId,
          jobId,
          post: {
            id: draft.id,
            postDate: draft.postDate,
            postTime: draft.postTime,
            title: draft.title,
            body: draft.body,
            status: draft.status,
            platforms: draft.platforms,
            linkUrl: draft.linkUrl,
          },
        });
        setPosts((current) =>
          current.map((post) => (post.id === tempId ? saved : post)),
        );
        return saved;
      } catch (error) {
        setPosts(previous);
        toast.error(getErrorMessage(error));
        return null;
      }
    },
    [accountId, jobId, posts],
  );

  const removePost = useCallback(
    async (id: string) => {
      const previous = posts;
      setPosts((current) => current.filter((post) => post.id !== id));
      try {
        await deleteContentPost({ accountId, jobId, id });
        return true;
      } catch (error) {
        setPosts(previous);
        toast.error(getErrorMessage(error));
        return false;
      }
    },
    [accountId, jobId, posts],
  );

  const saveNote = useCallback(
    async (kind: PeriodKind, periodStart: string, body: string) => {
      const start =
        kind === 'week' ? weekStart(periodStart) : monthStart(periodStart);
      const previous = notes;
      setNotes((current) => {
        const rest = current.filter(
          (note) => !(note.kind === kind && note.periodStart === start),
        );
        return body.trim()
          ? [
              ...rest,
              {
                id:
                  current.find(
                    (note) => note.kind === kind && note.periodStart === start,
                  )?.id ?? `temp-${kind}-${start}`,
                kind,
                periodStart: start,
                body,
              },
            ]
          : rest;
      });
      try {
        const saved = await savePeriodNote({
          accountId,
          jobId,
          kind,
          periodStart: start,
          body,
        });
        if (saved) {
          setNotes((current) =>
            current.map((note) =>
              note.kind === kind && note.periodStart === start ? saved : note,
            ),
          );
        }
      } catch (error) {
        setNotes(previous);
        toast.error(getErrorMessage(error));
      }
    },
    [accountId, jobId, notes],
  );

  const notesByKey = useMemo(() => indexNotes(notes), [notes]);

  return {
    posts,
    notes,
    notesByKey,
    loading,
    failed,
    reload,
    savePost,
    removePost,
    saveNote,
  };
}

export type ProjectContent = ReturnType<typeof useProjectContent>;
