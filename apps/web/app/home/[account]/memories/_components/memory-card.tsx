import Link from 'next/link';

import { NoteMarkdownBody } from '~/components/notes/note-markdown-body';
import {
  workspaceCardHover,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { MEMORY_KIND_LABELS, formatMemoryDay } from '../_lib/memory-constants';
import type { FamilyMemoryItem } from '../_lib/server/family-memories.loader';
import { ChildAvatar } from './child-avatar';

function excerpt(content: string, max = 220) {
  const plain = content
    .replace(/[#*_`>[\]]/g, '')
    .replace(/\n+/g, ' ')
    .trim();

  if (plain.length <= max) return plain;
  return `${plain.slice(0, max).trim()}…`;
}

export function MemoryCard({
  memory,
  noteHref,
  childHref,
}: {
  memory: FamilyMemoryItem;
  noteHref: string;
  childHref: (childId: string) => string;
}) {
  const preview = memory.media[0];
  const isVideo = preview?.mimeType?.startsWith('video/') ?? false;
  const extraMedia = Math.max(0, memory.media.length - 1);

  return (
    <article
      className={`${workspacePanelCard} ${workspaceCardHover} overflow-hidden`}
    >
      {preview?.url ? (
        <div className="relative aspect-[16/9] bg-[var(--workspace-control-surface)]">
          {isVideo ? (
            <video
              src={preview.url}
              className="h-full w-full object-cover"
              controls
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.url}
              alt={preview.title}
              className="h-full w-full object-cover"
            />
          )}
          {extraMedia > 0 ? (
            <span className="absolute right-2 bottom-2 rounded-full bg-[var(--ozer-plum-950)]/80 px-2 py-0.5 text-[11px] text-[var(--ozer-cream-50)]">
              +{extraMedia} more
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <time
            dateTime={memory.occurredOn}
            className={`text-xs ${workspaceTextMuted}`}
          >
            {formatMemoryDay(memory.occurredOn)}
          </time>
          {memory.kind ? (
            <span className="rounded-full bg-[var(--ozer-accent-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-accent-text)]">
              {MEMORY_KIND_LABELS[memory.kind]}
            </span>
          ) : null}
        </div>

        {memory.title ? (
          <h3 className="font-heading text-lg font-semibold tracking-tight">
            {memory.title}
          </h3>
        ) : null}

        {memory.media.length > 0 ? (
          <p className="text-sm leading-relaxed text-[var(--workspace-shell-text)]">
            {excerpt(memory.content)}
          </p>
        ) : (
          <NoteMarkdownBody
            markdown={memory.content}
            className="text-sm"
            emptyLabel="Empty memory"
          />
        )}

        {memory.children.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {memory.children.map((child) => (
              <Link
                key={child.id}
                href={childHref(child.id)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 py-1 text-xs text-[var(--workspace-shell-text)] hover:border-[var(--ozer-accent)]/40"
              >
                <ChildAvatar
                  name={child.display_name}
                  url={child.avatarUrl}
                  size="sm"
                />
                {child.display_name}
              </Link>
            ))}
          </div>
        ) : null}

        <Link
          href={noteHref}
          className="inline-flex text-xs font-medium text-[var(--workspace-shell-accent-text)] hover:text-[var(--ozer-accent)]"
        >
          Open full note
        </Link>
      </div>
    </article>
  );
}
