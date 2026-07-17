'use client';

import { useCallback, useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import * as tus from 'tus-js-client';

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
import { formatFileSize } from '~/lib/videos/format';
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

type UploadPhase = 'idle' | 'preparing' | 'uploading';

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
        const status = error.originalResponse?.getStatus();
        const body = error.originalResponse?.getBody?.() ?? '';
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

function UploadProgressPanel(props: {
  phase: Exclude<UploadPhase, 'idle'>;
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
}) {
  const label =
    props.phase === 'preparing' ? 'Preparing upload…' : 'Uploading…';

  const detail =
    props.phase === 'uploading'
      ? `${formatFileSize(props.uploadedBytes)} / ${formatFileSize(props.totalBytes)}`
      : 'Creating upload session';

  return (
    <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">{detail}</p>
        </div>
        <span className="text-sm font-medium text-[var(--ozer-accent)] tabular-nums">
          {props.progress}%
        </span>
      </div>

      <Progress
        value={props.progress}
        className="h-2 bg-black/30 [&>div]:bg-[var(--ozer-accent)]"
      />
    </div>
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
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState<string>(
    props.defaultFolderId ?? '__root__',
  );
  const [progress, setProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [phase, setPhase] = useState<UploadPhase>('idle');

  const reset = useCallback(() => {
    setFile(null);
    setTitle('');
    setFolderId(props.defaultFolderId ?? '__root__');
    setProgress(0);
    setUploadedBytes(0);
    setTotalBytes(0);
    setPhase('idle');
  }, [props.defaultFolderId]);

  const onDrop = useCallback((accepted: File[]) => {
    const next = accepted[0];
    if (!next) return;
    setFile(next);
    setTitle(titleFromFilename(next.name));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': [] },
    maxFiles: 1,
    disabled: phase !== 'idle',
  });

  const isUploading = phase === 'preparing' || phase === 'uploading';
  const canSubmit = Boolean(file && title.trim() && !isUploading);

  const submit = async () => {
    if (!file) return;

    setPhase('preparing');
    setProgress(0);
    setUploadedBytes(0);
    setTotalBytes(file.size);

    try {
      const createRes = await fetch('/api/videos/create-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: props.accountId,
          title: title.trim(),
          folderId: folderId === '__root__' ? null : folderId,
          originalFilename: file.name,
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

      setPhase('uploading');

      await uploadWithTus(
        file,
        {
          bunnyVideoId,
          libraryId,
          signature,
          expiry,
          tusEndpoint,
          title: title.trim(),
        },
        (loaded, total) => {
          setUploadedBytes(loaded);
          setTotalBytes(total);
          setProgress(Math.min(100, Math.round((loaded / total) * 100)));
        },
      );

      setUploadedBytes(file.size);
      setProgress(100);

      await fetch(`/api/videos/${videoId}/status`, { method: 'POST' });

      toast.success('Upload complete — encoding in the background');
      props.onUploadStarted?.(videoId);
      props.onOpenChange(false);
      reset();
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
      setPhase('idle');
      setProgress(0);
      setUploadedBytes(0);
      setTotalBytes(0);
    }
  };

  const folderOptions = useMemo(
    () => [{ id: '__root__', name: 'No folder' }, ...props.folders],
    [props.folders],
  );

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        // Allow closing anytime except mid-upload (bytes still transferring).
        if (!open && isUploading) return;
        if (!open) reset();
        props.onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-lg border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <DialogHeader>
          <DialogTitle>Upload video</DialogTitle>
          <DialogDescription>
            Upload finishes here; Bunny encodes in the background and the
            library updates when the video is ready.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-xl border border-dashed px-4 py-8 text-center transition ${
              isDragActive
                ? 'border-[var(--ozer-accent)]/60 bg-[var(--ozer-accent-subtle)]'
                : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] hover:border-[color:var(--workspace-shell-border)]'
            } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-muted-foreground text-xs">
                  {formatFileSize(file.size)}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Drag and drop a video, or click to browse
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="video-title">Title</Label>
            <Input
              id="video-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={isUploading}
            />
          </div>

          <div className="space-y-2">
            <Label>Folder</Label>
            <Select
              value={folderId}
              onValueChange={setFolderId}
              disabled={isUploading}
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

          {phase !== 'idle' ? (
            <UploadProgressPanel
              phase={phase}
              progress={progress}
              uploadedBytes={uploadedBytes}
              totalBytes={totalBytes}
            />
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (isUploading) return;
              props.onOpenChange(false);
              reset();
            }}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={submit}>
            {phase === 'idle' ? (
              'Upload'
            ) : (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading…
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
