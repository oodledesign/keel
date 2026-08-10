'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import {
  FileText,
  ImageIcon,
  Loader2,
  Plus,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import {
  MEDIA_TYPES,
  MEDIA_TYPE_LABELS,
  type MediaType,
} from '../_lib/schema/listings.schema';
import type { CommercialListingMedia } from '../_lib/server/listings.service';
import {
  createListingMedia,
  deleteListingMedia,
  setListingMediaCover,
} from '../_lib/server/server-actions';

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

function safeFileName(name: string) {
  return name.replace(/[/\\]/g, '_').replace(/\.\./g, '_').trim().slice(0, 180);
}

function inferMediaType(mime: string, preferred: MediaType): MediaType {
  if (preferred !== 'image') return preferred;
  if (mime === 'application/pdf') return 'brochure';
  return 'image';
}

export function ListingMediaSection({
  accountId,
  listingId,
  initialMedia,
}: {
  accountId: string;
  listingId: string;
  initialMedia: CommercialListingMedia[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [media, setMedia] = useState(initialMedia);
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMedia(initialMedia);
  }, [initialMedia]);

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);

    startTransition(async () => {
      const client = getSupabaseBrowserClient();
      const uploaded: CommercialListingMedia[] = [];

      try {
        for (const file of Array.from(files)) {
          if (file.size > MAX_BYTES) {
            throw new Error(`${file.name} is larger than 20MB`);
          }
          if (file.type && !ALLOWED.has(file.type)) {
            throw new Error(`${file.name}: use JPEG, PNG, WebP, GIF, or PDF`);
          }

          const path = `${accountId}/${listingId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
          const { error: uploadError } = await client.storage
            .from('commercial-listing-media')
            .upload(path, file, {
              contentType: file.type || undefined,
              upsert: false,
            });

          if (uploadError) {
            throw new Error(uploadError.message);
          }

          const created = await createListingMedia({
            accountId,
            listingId,
            mediaType: inferMediaType(file.type, mediaType),
            storagePath: path,
            fileName: file.name,
            mimeType: file.type || null,
            sortOrder: media.length + uploaded.length,
          });
          uploaded.push(created);
        }

        setMedia((prev) => [...prev, ...uploaded]);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        if (inputRef.current) inputRef.current.value = '';
      }
    });
  };

  const handleSetCover = (mediaId: string) => {
    startTransition(async () => {
      try {
        await setListingMediaCover({ mediaId, listingId, accountId });
        setMedia((prev) =>
          prev.map((item) => ({
            ...item,
            isCover: item.id === mediaId,
          })),
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not set cover');
      }
    });
  };

  const handleDelete = (mediaId: string) => {
    if (!confirm('Remove this media item?')) return;
    startTransition(async () => {
      try {
        await deleteListingMedia({ mediaId, accountId, listingId });
        setMedia((prev) => prev.filter((m) => m.id !== mediaId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed');
      }
    });
  };

  return (
    <Card className={workspacePanelCard}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          Media
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={mediaType}
            onValueChange={(v) => setMediaType(v as MediaType)}
          >
            <SelectTrigger className="h-9 w-[140px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEDIA_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {MEDIA_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            type="button"
            disabled={pending}
            className={workspaceBtnPrimaryMd}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        {media.length === 0 ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40 px-4 py-10 text-sm text-[var(--workspace-shell-text)]/50 transition-colors hover:border-[var(--ozer-accent)]/40 hover:text-[var(--workspace-shell-text)]/70"
          >
            <Plus className="h-5 w-5" />
            Add photos, floorplans, brochures or EPCs
          </button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {media.map((item) => {
              const isImage =
                item.mediaType === 'image' ||
                Boolean(item.mimeType?.startsWith('image/'));
              return (
                <div
                  key={item.id}
                  className="group relative overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
                >
                  {isImage && item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt={item.fileName ?? 'Listing media'}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-[var(--workspace-shell-text)]/40">
                      {item.mediaType === 'image' ? (
                        <ImageIcon className="h-8 w-8" />
                      ) : (
                        <FileText className="h-8 w-8" />
                      )}
                      <span className="px-3 text-center text-xs">
                        {item.fileName ?? MEDIA_TYPE_LABELS[item.mediaType]}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 border-t border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[var(--workspace-shell-text)]">
                        {item.fileName ?? 'Untitled'}
                        {item.isCover ? (
                          <span className="ml-1.5 text-[10px] font-semibold text-[var(--ozer-accent)] uppercase">
                            Cover
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[10px] text-[var(--workspace-shell-text)]/45 uppercase">
                        {MEDIA_TYPE_LABELS[item.mediaType]}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {isImage ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={pending || item.isCover}
                          title="Set as list thumbnail"
                          className="h-7 w-7 text-[var(--workspace-shell-text-muted)]"
                          onClick={() => handleSetCover(item.id)}
                        >
                          <Star
                            className={`h-3.5 w-3.5 ${item.isCover ? 'fill-[var(--ozer-accent)] text-[var(--ozer-accent)]' : ''}`}
                          />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={pending}
                        className="h-7 w-7 text-rose-400"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
