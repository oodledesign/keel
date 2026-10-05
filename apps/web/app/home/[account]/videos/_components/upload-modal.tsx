'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import * as tus from 'tus-js-client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Progress } from '@kit/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { estimateSecondsLeft, formatSecondsLeft } from '~/lib/videos/eta';
import { formatFileSize } from '~/lib/videos/format';
import {
  markUploadActive,
  markUploadInactive,
} from '~/lib/videos/stalled-upload';
import type { VideoFolderRow } from '~/lib/videos/types';

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: { message: string } };

type CreateUploadResponse = {
  videoId: string;
  bunnyVideoId: string;
  uploadUrl: string;
  signature: string;
  expiry: number;
  tusEndpoint: string;
  libraryId: string;
};

type ItemStatus = 'queued' | 'preparing' | 'uploading' | 'done' | 'error';

type UploadItem = {
  id: string;
  file: File;
  title: string;
  status: ItemStatus;
  uploadedBytes: number;
  /** Set once the upload session exists, so a discard can clean it up. */
  videoId?: string;
  error?: string;
};

/** Uploads are bandwidth-bound; two at once keeps the pipe full without starving either. */
const UPLOAD_CONCURRENCY = 2;

function titleFromFilename(name: string) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

const TUS_CHUNK_SIZE = 50 * 1024 * 1024;

function uploadWithTus(
  file: File,
  credentials: {
    bunnyVideoId: string;
    libraryId: string;
    signature: string;
    expiry: number;
    tusEndpoint: string;
    title: string;
  },
  onProgress: (loaded: number, total: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: credentials.tusEndpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000, 60000, 60000],
      chunkSize: TUS_CHUNK_SIZE,
      headers: {
        AuthorizationSignature: credentials.signature,
        AuthorizationExpire: String(credentials.expiry),
        VideoId: credentials.bunnyVideoId,
        LibraryId: credentials.libraryId,
      },
      metadata: {
        filetype: file.type || 'video/mp4',
        title: credentials.title,
      },
      onError(error) {
        const detailed = error as tus.DetailedError;
        const status = detailed.originalResponse?.getStatus();
        const body = detailed.originalResponse?.getBody?.() ?? '';
        reject(
          new Error(
            status
              ? `Upload failed (${status})${body ? `: ${body.slice(0, 200)}` : ''}`
              : error.message || 'Upload failed',
          ),
        );
      },
      onProgress(bytesUploaded, bytesTotal) {
        onProgress(bytesUploaded, bytesTotal);
      },
      onSuccess() {
        resolve();
      },
    });

    signal.addEventListener('abort', () => {
      void upload
        .abort(true)
        .finally(() => reject(new Error('Upload cancelled')));
    });

    void upload
      .findPreviousUploads()
      .then((previousUploads) => {
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]!);
        }
        upload.start();
      })
      .catch(reject);
  });
}

function ItemRow(props: {
  item: UploadItem;
  locked: boolean;
  onTitle: (title: string) => void;
  onRemove: () => void;
}) {
  const { item } = props;
  const total = item.file.size || 1;
  const pct =
    item.status === 'done'
      ? 100
      : Math.min(100, Math.round((item.uploadedBytes / total) * 100));
  const active = item.status === 'preparing' || item.status === 'uploading';

  return (
    <li className="space-y-2 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
      <div className="flex items-center gap-2">
        <Input
          value={item.title}
          onChange={(event) => props.onTitle(event.target.value)}
          disabled={props.locked || item.status === 'done'}
          aria-label={`Title for ${item.file.name}`}
          className="h-8 min-w-0 flex-1"
        />
        <span className="flex w-8 shrink-0 justify-center">
          {item.status === 'done' ? (
            <Check className="h-4 w-4 text-emerald-500" aria-label="Uploaded" />
          ) : item.status === 'error' ? (
            <AlertCircle
              className="text-destructive h-4 w-4"
              aria-label="Failed"
            />
          ) : active ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-label="Uploading" />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={props.locked}
              onClick={props.onRemove}
              aria-label={`Remove ${item.file.name}`}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </span>
      </div>
      <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
        <span className="truncate">{item.file.name}</span>
        <span className="shrink-0 tabular-nums">
          {item.status === 'queued'
            ? `${formatFileSize(item.file.size)} · waiting`
            : item.status === 'preparing'
              ? 'Preparing…'
              : item.status === 'error'
                ? 'Failed'
                : item.status === 'done'
                  ? 'Uploaded · encoding next'
                  : `${formatFileSize(item.uploadedBytes)} / ${formatFileSize(item.file.size)} · ${pct}%`}
        </span>
      </div>
      {active || item.status === 'done' ? (
        <Progress
          value={pct}
          className="h-1.5 bg-black/30 [&>div]:bg-[var(--ozer-accent)]"
        />
      ) : null}
      {item.status === 'error' && item.error ? (
        <p className="text-destructive text-xs">{item.error}</p>
      ) : null}
    </li>
  );
}

export function UploadModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  folders: VideoFolderRow[];
  defaultFolderId?: string | null;
  onUploadStarted?: (videoId: string) => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [folderId, setFolderId] = useState<string>(
    props.defaultFolderId ?? '__root__',
  );
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const batchStartedAt = useRef(0);

  // Leaving or refreshing mid-upload drops the transfer; ask first.
  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running]);

  const patchItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const reset = useCallback(() => {
    setItems([]);
    setFolderId(props.defaultFolderId ?? '__root__');
    setRunning(false);
  }, [props.defaultFolderId]);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length === 0) return;
    setItems((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        title: titleFromFilename(file.name),
        status: 'queued' as const,
        uploadedBytes: 0,
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': [] },
    disabled: running,
  });

  const pending = items.filter(
    (item) => item.status === 'queued' || item.status === 'error',
  );
  const canSubmit =
    !running &&
    pending.length > 0 &&
    pending.every((item) => item.title.trim().length > 0);

  const uploadOne = async (item: UploadItem, signal: AbortSignal) => {
    const title = item.title.trim();
    let activeId: string | null = null;
    patchItem(item.id, {
      status: 'preparing',
      uploadedBytes: 0,
      error: undefined,
    });

    try {
      const createRes = await fetch('/api/videos/create-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: props.accountId,
          title,
          folderId: folderId === '__root__' ? null : folderId,
          originalFilename: item.file.name,
        }),
      });

      const createJson = (await createRes.json()) as
        | ApiOk<CreateUploadResponse>
        | ApiErr;
      if (!createJson.ok) throw new Error(createJson.error.message);

      const {
        videoId,
        bunnyVideoId,
        signature,
        expiry,
        tusEndpoint,
        libraryId,
      } = createJson.data;

      patchItem(item.id, { status: 'uploading' });

      patchItem(item.id, { videoId });
      markUploadActive(videoId);
      activeId = videoId;

      await uploadWithTus(
        item.file,
        { bunnyVideoId, libraryId, signature, expiry, tusEndpoint, title },
        (loaded) => patchItem(item.id, { uploadedBytes: loaded }),
        signal,
      );

      await fetch(`/api/videos/${videoId}/status`, { method: 'POST' });

      patchItem(item.id, { status: 'done', uploadedBytes: item.file.size });
      props.onUploadStarted?.(videoId);
      return true;
    } catch (error) {
      // A discard resets everything, so don't flash an error for it.
      if (!signal.aborted) {
        patchItem(item.id, { status: 'error', error: getErrorMessage(error) });
      }
      return false;
    } finally {
      if (activeId) markUploadInactive(activeId);
    }
  };

  const submit = async () => {
    const queue = [...pending];
    if (queue.length === 0) return;

    const controller = new AbortController();
    abortRef.current = controller;
    batchStartedAt.current = Date.now();
    setRunning(true);
    let succeeded = 0;
    let failed = 0;

    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        if (controller.signal.aborted) return;
        if (await uploadOne(next, controller.signal)) succeeded += 1;
        else failed += 1;
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(UPLOAD_CONCURRENCY, queue.length) },
        worker,
      ),
    );

    if (controller.signal.aborted) return;

    abortRef.current = null;
    setRunning(false);
    router.refresh();

    if (failed === 0) {
      toast.success(
        succeeded === 1
          ? 'Upload complete — encoding in the background'
          : `${succeeded} uploads complete — encoding in the background`,
      );
      props.onOpenChange(false);
      reset();
    } else {
      toast.error(
        `${failed} ${failed === 1 ? 'upload' : 'uploads'} failed. Review and retry.`,
      );
    }
  };

  const unfinished = items.filter((item) => item.status !== 'done');

  const requestClose = () => {
    if (running || unfinished.length > 0) {
      setConfirmOpen(true);
      return;
    }
    props.onOpenChange(false);
    reset();
  };

  const discard = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    // Remove upload sessions that never completed so they don't linger as
    // "uploading" rows in the library.
    for (const item of unfinished) {
      if (item.videoId) {
        void fetch(`/api/videos/${item.videoId}`, { method: 'DELETE' });
      }
    }
    setConfirmOpen(false);
    props.onOpenChange(false);
    reset();
    router.refresh();
  };

  const folderOptions = useMemo(
    () => [{ id: '__root__', name: 'No folder' }, ...props.folders],
    [props.folders],
  );

  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);
  const uploadedTotal = items.reduce(
    (sum, item) =>
      sum + (item.status === 'done' ? item.file.size : item.uploadedBytes),
    0,
  );
  const timeLeft = running
    ? formatSecondsLeft(
        estimateSecondsLeft({
          fraction: totalBytes > 0 ? uploadedTotal / totalBytes : 0,
          startFraction: 0,
          elapsedMs: Date.now() - batchStartedAt.current,
        }),
      )
    : null;

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) {
          requestClose();
          return;
        }
        props.onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-lg border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <DialogHeader>
          <DialogTitle>Upload videos</DialogTitle>
          <DialogDescription>
            Add one or more videos. Uploads finish here; Bunny encodes in the
            background and the library updates when each video is ready.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-xl border border-dashed px-4 py-6 text-center transition ${
              isDragActive
                ? 'border-[var(--ozer-accent)]/60 bg-[var(--ozer-accent-subtle)]'
                : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] hover:border-[color:var(--workspace-shell-border)]'
            } ${running ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input {...getInputProps()} />
            <p className="text-muted-foreground text-sm">
              {items.length > 0
                ? 'Drop more videos, or click to add'
                : 'Drag and drop videos, or click to browse'}
            </p>
          </div>

          {items.length > 0 ? (
            <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  locked={running}
                  onTitle={(title) => patchItem(item.id, { title })}
                  onRemove={() =>
                    setItems((current) =>
                      current.filter((entry) => entry.id !== item.id),
                    )
                  }
                />
              ))}
            </ul>
          ) : null}

          <div className="space-y-2">
            <Label>Folder</Label>
            <Select
              value={folderId}
              onValueChange={setFolderId}
              disabled={running}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent>
                {folderOptions.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">
            {items.length > 0
              ? `${items.length} ${items.length === 1 ? 'video' : 'videos'} · ${formatFileSize(totalBytes)}${timeLeft ? ` · ${timeLeft}` : ''}`
              : ''}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={requestClose}>
              {running ? 'Cancel upload' : 'Cancel'}
            </Button>
            <Button type="button" disabled={!canSubmit} onClick={submit}>
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : pending.length > 1 ? (
                `Upload ${pending.length} videos`
              ) : (
                'Upload'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {running ? 'Cancel this upload?' : 'Discard these videos?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {running
                ? 'Uploads in progress will be stopped and the files discarded. Videos that already finished uploading are kept.'
                : `${unfinished.length === 1 ? 'This video hasn’t' : `These ${unfinished.length} videos haven’t`} been uploaded yet and will be discarded.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {running ? 'Keep uploading' : 'Keep editing'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={discard}>
              {running ? 'Cancel upload' : 'Discard'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
