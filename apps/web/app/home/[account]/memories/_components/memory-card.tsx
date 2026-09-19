import Link from 'next/link';

import { NoteMarkdownBody } from '~/components/notes/note-markdown-body';
import {
  workspaceCardHover,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { MEMORY_KIND_LABELS, formatMemoryDay } from '../_lib/memory-constants';
import type { FamilyMemoryMediaItem } from '../_lib/schemas/family-memories.schema';
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

function mediaKind(item: FamilyMemoryMediaItem) {
  return (
    item.kind ??
    (item.mimeType?.startsWith('video/')
      ? 'video'
      : item.mimeType?.startsWith('audio/')
        ? 'audio'
        : item.mimeType?.startsWith('image/')
          ? 'image'
          : null)
  );
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
  const visual = memory.media.filter((item) => {
    const kind = mediaKind(item);
    return kind === 'image' || kind === 'video';
  });
  const audio = memory.media.filter((item) => mediaKind(item) === 'audio');
  const preview = visual[0];
  const extraVisual = Math.max(0, visual.length - 1);

  return (
    <article
      className={`${workspacePanelCard} ${workspaceCardHover} overflow-hidden`}
    >
      {preview?.url ? (
        <div className="relative aspect-[16/9] bg-[var(--workspace-control-surface)]">
          {mediaKind(preview) === 'video' ? (
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
          {extraVisual > 0 ? (
            <span className="absolute right-2 bottom-2 rounded-full bg-[var(--ozer-plum-950)]/80 px-2 py-0.5 text-[11px] text-[var(--ozer-cream-50)]">
              +{extraVisual} more
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

        {audio.length > 0 ? (
          <div className="space-y-2">
            {audio.map((item) =>
              item.url ? (
                <div key={item.id} className="space-y-1">
                  <p className={`text-[11px] ${workspaceTextMuted}`}>
                    {item.title || 'Voice note'}
                  </p>
                  <audio
                    src={item.url}
                    controls
                    preload="metadata"
                    className="w-full"
                  />
                </div>
              ) : null,
            )}
          </div>
        ) : null}

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
                <span>
                  {child.display_name}
                  {child.ageLabel ? (
                    <span className={workspaceTextMuted}>
                      {' '}
                      · {child.ageLabel}
                    </span>
                  ) : null}
                </span>
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
