'use client';

import { useRef, useState } from 'react';

import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import { saveCoverDefaultImageAction } from '~/home/[account]/surveys/_lib/server/survey-report-details-actions';
import {
  COVER_IMAGE_MAX_BYTES,
  coverImageFolder,
} from '~/lib/building-surveyor/survey-cover';
import { workspacePanelCard, workspaceTextMuted } from '~/lib/workspace-ui';

const ACCEPT = 'image/jpeg,image/png,image/webp';

export function CoverImageSettings({
  accountId,
  accountSlug,
  initialUrl,
}: {
  accountId: string;
  accountSlug: string;
  initialUrl: string | null;
}) {
  const supabase = useSupabase();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);

  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!ACCEPT.split(',').includes(file.type)) {
      toast.error('Use a JPEG, PNG or WebP image');
      return;
    }
    if (file.size > COVER_IMAGE_MAX_BYTES) {
      toast.error('The image must be 10 MB or smaller');
      return;
    }

    setBusy(true);
    let filePath: string | null = null;
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      filePath = `${coverImageFolder(accountId)}${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(ACCOUNT_DOCS_BUCKET)
        .upload(filePath, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;

      await saveCoverDefaultImageAction({ accountId, accountSlug, filePath });
      setPreviewUrl((current) => {
        if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
        return URL.createObjectURL(file);
      });
      toast.success('Default cover image saved');
    } catch (error) {
      if (filePath) {
        // Best effort: don't leave an orphaned upload behind.
        await supabase.storage.from(ACCOUNT_DOCS_BUCKET).remove([filePath]);
      }
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await saveCoverDefaultImageAction({
        accountId,
        accountSlug,
        filePath: null,
      });
      setPreviewUrl(null);
      toast.success('Default cover image removed');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`${workspacePanelCard} space-y-3 p-4 sm:p-5`}
      data-test="cover-image-settings"
    >
      <div>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Default cover image
        </h3>
        <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
          Shown on the front cover of any report that doesn&apos;t have its own
          building photo, for example a branded image or a stock street scene.
          Pick a photo of the property on each survey&apos;s Setup tab to
          override this.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="bg-muted/40 flex h-28 w-44 items-center justify-center overflow-hidden rounded-lg border">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Default cover"
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon
              className={`h-6 w-6 ${workspaceTextMuted}`}
              aria-hidden
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => void upload(event.target.files)}
            data-test="cover-image-input"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            data-test="cover-image-upload"
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {previewUrl ? 'Replace image' : 'Upload image'}
          </Button>
          {previewUrl ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void remove()}
              data-test="cover-image-remove"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
