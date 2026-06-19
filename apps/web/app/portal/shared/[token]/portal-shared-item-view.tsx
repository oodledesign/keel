'use client';

import { Download } from 'lucide-react';

import { Button } from '@kit/ui/button';

import {
  NOTE_FILE_CATEGORY_LABELS,
  type NoteFileCategory,
} from '~/home/[account]/_lib/workspace-content/types';

type SharedItem = {
  type: 'note' | 'file';
  title: string;
  content: string | null;
  category: string;
  updatedAt: string;
  mimeType: string | null;
  fileUrl: string | null;
  kind: string | null;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function categoryLabel(category: string) {
  const key = category as NoteFileCategory;
  return NOTE_FILE_CATEGORY_LABELS[key] ?? category;
}

export function PortalSharedItemView({
  item,
  embed,
  token,
}: {
  item: SharedItem;
  embed: boolean;
  token: string;
}) {
  const isImage =
    item.mimeType?.startsWith('image/') && item.fileUrl && item.kind === 'uploaded';

  return (
    <article className="space-y-4">
      {!embed ? (
        <p className="text-xs text-zinc-500">Shared {item.type === 'note' ? 'note' : 'file'}</p>
      ) : null}
      <header className="space-y-2 border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-zinc-300">
            {categoryLabel(item.category)}
          </span>
          {item.updatedAt ? (
            <span className="text-xs text-zinc-500">{formatDate(item.updatedAt)}</span>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold text-white">{item.title}</h1>
      </header>

      {item.type === 'note' ? (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
          {item.content || 'No content.'}
        </div>
      ) : item.kind === 'uploaded' ? (
        <div className="space-y-4">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.fileUrl ?? ''}
              alt={item.title}
              className="max-h-[70vh] w-full rounded-lg border border-white/10 object-contain"
            />
          ) : null}
          {item.fileUrl ? (
            <Button asChild className="bg-[#2A9D8F] text-white hover:bg-[#238b7f]">
              <a href={item.fileUrl} download target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Download {item.mimeType ?? 'file'}
              </a>
            </Button>
          ) : (
            <p className="text-sm text-zinc-400">Download link unavailable.</p>
          )}
        </div>
      ) : (
        <div
          className="prose prose-invert max-w-none text-sm"
          dangerouslySetInnerHTML={{ __html: item.content ?? '' }}
        />
      )}

      {!embed ? (
        <p className="pt-6 text-xs text-zinc-600">
          Shared via Ozer · token {token.slice(0, 8)}…
        </p>
      ) : null}
    </article>
  );
}
