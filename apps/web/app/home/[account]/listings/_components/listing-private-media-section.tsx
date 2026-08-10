'use client';

import { useRef, useState, useTransition } from 'react';

import { FileText, ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';

import { workspacePanelCard } from '~/lib/workspace-ui';

import type { CommercialListingMedia } from '../_lib/server/listings.service';
import {
  createListingMedia,
  deleteListingMedia,
} from '../_lib/server/server-actions';

const MAX_BYTES = 100 * 1024 * 1024;
const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const FILE_TYPES = new Set([
  ...IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function safeFileName(name: string) {
  return name.replace(/[/\\]/g, '_').replace(/\.\./g, '_').trim().slice(0, 180);
}

function PrivateUploadCard({
  title,
  description,
  accountId,
  listingId,
  mode,
  initialMedia,
}: {
  title: string;
  description: string;
  accountId: string;
  listingId: string;
  mode: 'images' | 'files';
  initialMedia: CommercialListingMedia[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState(initialMedia);
  const [pending, startTransition] = useTransition();

  const accept =
    mode === 'images'
      ? 'image/jpeg,image/png,image/webp,image/gif'
      : '.pdf,.doc,.docx,.xls,.xlsx,image/*';

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;

    startTransition(async () => {
      const client = getSupabaseBrowserClient();
      const uploaded: CommercialListingMedia[] = [];
      const uploadedPaths: string[] = [];

      try {
        for (const file of Array.from(files)) {
          if (file.size > MAX_BYTES) {
            throw new Error(`${file.name} is larger than 100MB`);
          }
          const allowed =
            mode === 'images'
              ? IMAGE_TYPES.has(file.type)
              : FILE_TYPES.has(file.type) || file.type.startsWith('image/');
          if (file.type && !allowed) {
            throw new Error(`${file.name}: unsupported file type`);
          }

          const path = `${accountId}/${listingId}/private/${crypto.randomUUID()}-${safeFileName(file.name)}`;
          const { error: uploadError } = await client.storage
            .from('commercial-listing-media')
            .upload(path, file, {
              contentType: file.type || undefined,
              upsert: false,
            });
          if (uploadError) throw new Error(uploadError.message);
          uploadedPaths.push(path);

          const created = await createListingMedia({
            accountId,
            listingId,
            mediaType: file.type.startsWith('image/') ? 'image' : 'other',
            storagePath: path,
            fileName: file.name,
            mimeType: file.type || null,
            sortOrder: media.length + uploaded.length,
            isPrivate: true,
            isCover: false,
          });
          uploaded.push(created);
        }

        setMedia((prev) => [...prev, ...uploaded]);
        toast.success(
          uploaded.length === 1
            ? 'Private file uploaded'
            : `${uploaded.length} private files uploaded`,
        );
      } catch (err) {
        const orphaned = uploadedPaths.slice(uploaded.length);
        if (orphaned.length > 0) {
          await client.storage
            .from('commercial-listing-media')
            .remove(orphaned)
            .catch(() => undefined);
        }
        toast.error(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        if (inputRef.current) inputRef.current.value = '';
      }
    });
  };

  const remove = (item: CommercialListingMedia) => {
    startTransition(async () => {
      try {
        await deleteListingMedia({
          accountId,
          listingId,
          mediaId: item.id,
        });
        setMedia((prev) => prev.filter((m) => m.id !== item.id));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not delete');
      }
    });
  };

  return (
    <Card className={workspacePanelCard}>
      <CardHeader>
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          {title}
        </CardTitle>
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          {description}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40 px-4 py-8 text-center"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
        >
          <Upload className="mb-2 h-5 w-5 text-[var(--workspace-shell-text)]/40" />
          <p className="text-sm text-[var(--workspace-shell-text)]">
            Drag &amp; drop your {mode === 'images' ? 'images' : 'files'} here
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={pending}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === 'images' ? (
              'Choose images…'
            ) : (
              'Choose files…'
            )}
          </Button>
          <p className="mt-2 text-xs text-[var(--workspace-shell-text)]/45">
            Max file size 100 MB. Not shown on marketing or portals.
          </p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            accept={accept}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {media.length > 0 ? (
          <ul className="space-y-2">
            {media.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-lg bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-2"
              >
                {item.mediaType === 'image' ||
                item.mimeType?.startsWith('image/') ? (
                  <ImageIcon className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text)]/40" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text)]/40" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--workspace-shell-text)]">
                  {item.fileName ?? 'Private file'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={pending}
                  onClick={() => remove(item)}
                  aria-label={`Delete ${item.fileName ?? 'file'}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ListingPrivateMediaSection({
  accountId,
  listingId,
  privateImages,
  privateFiles,
}: {
  accountId: string;
  listingId: string;
  privateImages: CommercialListingMedia[];
  privateFiles: CommercialListingMedia[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PrivateUploadCard
        title="Private images"
        description="Internal photos not published on marketing media or portals."
        accountId={accountId}
        listingId={listingId}
        mode="images"
        initialMedia={privateImages}
      />
      <PrivateUploadCard
        title="Private files"
        description="Internal documents (ToE, H&S, landlord packs, etc.)."
        accountId={accountId}
        listingId={listingId}
        mode="files"
        initialMedia={privateFiles}
      />
    </div>
  );
}
