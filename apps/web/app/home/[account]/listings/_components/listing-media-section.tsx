'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import {
  ChevronLeft,
  ChevronRight,
  FileText,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from '@kit/ui/sonner';

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  updateListingMedia,
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

function isImageMedia(item: CommercialListingMedia) {
  return (
    item.mediaType === 'image' ||
    item.mediaType === 'floorplan' ||
    Boolean(item.mimeType?.startsWith('image/'))
  );
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
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [media, setMedia] = useState(initialMedia);
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [renameTarget, setRenameTarget] =
    useState<CommercialListingMedia | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setMedia(initialMedia);
  }, [initialMedia]);

  const imageItems = useMemo(
    () => media.filter((item) => isImageMedia(item) && Boolean(item.url)),
    [media],
  );

  const lightboxItem =
    lightboxIndex != null ? (imageItems[lightboxIndex] ?? null) : null;

  useEffect(() => {
    if (lightboxIndex == null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setLightboxIndex((prev) =>
          prev == null || imageItems.length === 0
            ? prev
            : (prev - 1 + imageItems.length) % imageItems.length,
        );
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setLightboxIndex((prev) =>
          prev == null || imageItems.length === 0
            ? prev
            : (prev + 1) % imageItems.length,
        );
      } else if (event.key === 'Escape') {
        setLightboxIndex(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, imageItems.length]);

  const openLightbox = (item: CommercialListingMedia) => {
    const index = imageItems.findIndex((row) => row.id === item.id);
    if (index >= 0) setLightboxIndex(index);
  };

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
        if (uploadInputRef.current) uploadInputRef.current.value = '';
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
        toast.success('Cover image updated');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not set cover');
      }
    });
  };

  const handleDelete = (item: CommercialListingMedia) => {
    if (!confirm(`Remove ${item.fileName ?? 'this media item'}?`)) return;
    startTransition(async () => {
      try {
        await deleteListingMedia({
          mediaId: item.id,
          accountId,
          listingId,
        });
        setMedia((prev) => {
          const next = prev.filter((m) => m.id !== item.id);
          setLightboxIndex((prevIndex) => {
            if (prevIndex == null) return prevIndex;
            const nextImages = next.filter(
              (row) => isImageMedia(row) && Boolean(row.url),
            );
            if (nextImages.length === 0) return null;
            return Math.min(prevIndex, nextImages.length - 1);
          });
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed');
      }
    });
  };

  const openRename = (item: CommercialListingMedia) => {
    setRenameTarget(item);
    setRenameValue(item.fileName ?? '');
  };

  const saveRename = () => {
    if (!renameTarget) return;
    const nextName = renameValue.trim();
    if (!nextName) {
      toast.error('Enter a file name');
      return;
    }

    startTransition(async () => {
      try {
        const updated = await updateListingMedia({
          accountId,
          listingId,
          mediaId: renameTarget.id,
          fileName: nextName,
        });
        setMedia((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
        setRenameTarget(null);
        toast.success('Renamed');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not rename');
      }
    });
  };

  const startReplace = (item: CommercialListingMedia) => {
    setReplaceTargetId(item.id);
    replaceInputRef.current?.click();
  };

  const handleReplace = (files: FileList | null) => {
    const file = files?.[0];
    const mediaId = replaceTargetId;
    setReplaceTargetId(null);
    if (!file || !mediaId) return;

    startTransition(async () => {
      const client = getSupabaseBrowserClient();
      try {
        if (file.size > MAX_BYTES) {
          throw new Error(`${file.name} is larger than 20MB`);
        }
        if (file.type && !ALLOWED.has(file.type)) {
          throw new Error('Use JPEG, PNG, WebP, GIF, or PDF');
        }

        const path = `${accountId}/${listingId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await client.storage
          .from('commercial-listing-media')
          .upload(path, file, {
            contentType: file.type || undefined,
            upsert: false,
          });
        if (uploadError) throw new Error(uploadError.message);

        const existing = media.find((item) => item.id === mediaId);
        const updated = await updateListingMedia({
          accountId,
          listingId,
          mediaId,
          storagePath: path,
          fileName: file.name,
          mimeType: file.type || null,
          mediaType: inferMediaType(
            file.type,
            existing?.mediaType ?? mediaType,
          ),
        });

        setMedia((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
        router.refresh();
        toast.success('File replaced');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Replace failed');
      } finally {
        if (replaceInputRef.current) replaceInputRef.current.value = '';
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
            ref={uploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            className="hidden"
            onChange={(e) => handleReplace(e.target.files)}
          />
          <Button
            type="button"
            disabled={pending}
            className={workspaceBtnPrimaryMd}
            onClick={() => uploadInputRef.current?.click()}
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
            onClick={() => uploadInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40 px-4 py-10 text-sm text-[var(--workspace-shell-text)]/50 transition-colors hover:border-[var(--ozer-accent)]/40 hover:text-[var(--workspace-shell-text)]/70"
          >
            <Plus className="h-5 w-5" />
            Add photos, floorplans, brochures or EPCs
          </button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {media.map((item) => {
              const isImage = isImageMedia(item);
              return (
                <div
                  key={item.id}
                  className="group relative overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
                >
                  {isImage && item.url ? (
                    <button
                      type="button"
                      className="block w-full cursor-zoom-in text-left"
                      onClick={() => openLightbox(item)}
                      aria-label={`View ${item.fileName ?? 'image'}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={item.fileName ?? 'Listing media'}
                        className="aspect-[4/3] w-full object-cover transition-opacity group-hover:opacity-95"
                      />
                    </button>
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={pending}
                          className="h-7 w-7 text-[var(--workspace-shell-text-muted)]"
                          aria-label={`Actions for ${item.fileName ?? 'media'}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
                      >
                        <DropdownMenuItem
                          onClick={() => openRename(item)}
                          className="gap-2"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => startReplace(item)}
                          className="gap-2"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Replace
                        </DropdownMenuItem>
                        {isImage ? (
                          <DropdownMenuItem
                            disabled={item.isCover}
                            onClick={() => handleSetCover(item.id)}
                            className="gap-2"
                          >
                            <Star className="h-3.5 w-3.5" />
                            {item.isCover ? 'Cover image' : 'Set as cover'}
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(item)}
                          className="gap-2 text-rose-600 focus:text-rose-600 dark:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {lightboxItem ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
          role="dialog"
          aria-modal="true"
          aria-label="Media lightbox"
          onClick={() => setLightboxIndex(null)}
          onTouchStart={(event) => {
            touchStartX.current = event.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchStartX.current;
            const end = event.changedTouches[0]?.clientX;
            touchStartX.current = null;
            if (start == null || end == null || imageItems.length < 2) return;
            const delta = end - start;
            if (Math.abs(delta) < 50) return;
            setLightboxIndex((prev) =>
              prev == null
                ? prev
                : delta > 0
                  ? (prev - 1 + imageItems.length) % imageItems.length
                  : (prev + 1) % imageItems.length,
            );
          }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {lightboxItem.fileName ?? 'Untitled'}
              </p>
              <p className="text-xs text-white/60">
                {(lightboxIndex ?? 0) + 1} of {imageItems.length}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
              onClick={(event) => {
                event.stopPropagation();
                setLightboxIndex(null);
              }}
              aria-label="Close lightbox"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-8"
            onClick={(event) => event.stopPropagation()}
          >
            {imageItems.length > 1 ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute left-3 h-11 w-11 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
                  onClick={() =>
                    setLightboxIndex((prev) =>
                      prev == null
                        ? prev
                        : (prev - 1 + imageItems.length) % imageItems.length,
                    )
                  }
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 h-11 w-11 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
                  onClick={() =>
                    setLightboxIndex((prev) =>
                      prev == null ? prev : (prev + 1) % imageItems.length,
                    )
                  }
                  aria-label="Next image"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            ) : null}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxItem.url ?? undefined}
              alt={lightboxItem.fileName ?? 'Listing media'}
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          </div>
        </div>
      ) : null}

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename media</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="media-rename">File name</Label>
            <Input
              id="media-rename"
              value={renameValue}
              disabled={pending}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveRename();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setRenameTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !renameValue.trim()}
              className={workspaceBtnPrimaryMd}
              onClick={saveRename}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
