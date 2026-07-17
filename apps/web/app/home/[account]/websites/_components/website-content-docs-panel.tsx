'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { SimpleMarkdownEditor } from '~/components/simple-markdown-editor';
import type { WebsiteContentDoc } from '~/lib/websites/planning-types';

import {
  createWebsiteContentDoc,
  deleteWebsiteContentDoc,
  updateWebsiteContentDoc,
} from '../_lib/server/planning-actions';

export function WebsiteContentDocsPanel({
  accountId,
  websiteId,
  initialDocs,
  canEdit,
}: {
  accountId: string;
  websiteId: string;
  initialDocs: WebsiteContentDoc[];
  canEdit: boolean;
}) {
  const [docs, setDocs] = useState(initialDocs);
  const [activeDocId, setActiveDocId] = useState<string | null>(
    initialDocs[0]?.id ?? null,
  );
  const [, startTransition] = useTransition();
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    return () => {
      for (const timer of saveTimers.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  // Only re-sync when the server bundle identity changes — not when the user
  // selects/creates a doc (activeDocId used to be a dep and wiped local state).
  useEffect(() => {
    setDocs(initialDocs);
    setActiveDocId((current) => {
      if (current && initialDocs.some((doc) => doc.id === current)) {
        return current;
      }
      return initialDocs[0]?.id ?? null;
    });
  }, [initialDocs]);

  const activeDoc = docs.find((doc) => doc.id === activeDocId) ?? null;

  function persistDoc(
    docId: string,
    patch: { title?: string; contentMd?: string },
  ) {
    setDocs((current) =>
      current.map((doc) =>
        doc.id === docId
          ? {
              ...doc,
              ...(patch.title !== undefined ? { title: patch.title } : {}),
              ...(patch.contentMd !== undefined
                ? { contentMd: patch.contentMd }
                : {}),
            }
          : doc,
      ),
    );

    const existing = saveTimers.current.get(docId);
    if (existing) clearTimeout(existing);

    saveTimers.current.set(
      docId,
      setTimeout(() => {
        startTransition(async () => {
          try {
            await updateWebsiteContentDoc({
              accountId,
              websiteId,
              docId,
              ...patch,
            });
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : 'Could not save document',
            );
          }
        });
      }, 700),
    );
  }

  function addDoc() {
    startTransition(async () => {
      try {
        const created = await createWebsiteContentDoc({
          accountId,
          websiteId,
          title: 'Untitled',
        });
        setDocs((current) => [...current, created as WebsiteContentDoc]);
        setActiveDocId((created as WebsiteContentDoc).id);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create document',
        );
      }
    });
  }

  function removeDoc(docId: string) {
    startTransition(async () => {
      try {
        await deleteWebsiteContentDoc({ accountId, websiteId, docId });
        setDocs((current) => current.filter((doc) => doc.id !== docId));
        setActiveDocId((current) => (current === docId ? null : current));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not delete document',
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--workspace-shell-text)]/70">
          Client copy, references, and specs — stored as Markdown.
        </p>
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
            onClick={addDoc}
          >
            <Plus className="mr-2 h-4 w-4" />
            New doc
          </Button>
        ) : null}
      </div>

      {docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center text-sm text-[var(--workspace-shell-text-muted)]">
          Add a doc per page or topic — hero copy, team bios, references…
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <ul className="space-y-1">
            {docs.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => setActiveDocId(doc.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    activeDocId === doc.id
                      ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-text)]'
                      : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
                  )}
                >
                  <span className="truncate">{doc.title}</span>
                  {canEdit ? (
                    <span
                      role="button"
                      tabIndex={0}
                      className="ml-2 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeDoc(doc.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.stopPropagation();
                          removeDoc(doc.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>

          {activeDoc ? (
            <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/40 p-4">
              <Input
                value={activeDoc.title}
                readOnly={!canEdit}
                onChange={(event) =>
                  persistDoc(activeDoc.id, { title: event.target.value })
                }
                className="h-9 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]"
              />
              <SimpleMarkdownEditor
                value={activeDoc.contentMd}
                readOnly={!canEdit}
                rows={16}
                placeholder="Write client content, reference links, typography choices…"
                onChange={(value) =>
                  persistDoc(activeDoc.id, { contentMd: value })
                }
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
