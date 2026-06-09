'use client';

import { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';

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

function titleFromFilename(name: string) {
  return name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
}

function uploadWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PATCH', url);
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(file);
  });
}

async function pollVideoStatus(videoId: string) {
  const maxAttempts = 120;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const res = await fetch(`/api/videos/${videoId}/status`);
    const json = (await res.json()) as ApiOk<{ status: string }> | ApiErr;
    if (!json.ok) throw new Error(json.error.message);
    if (json.data.status === 'ready') return 'ready';
    if (json.data.status === 'failed') return 'failed';
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('Encoding timed out');
}

export function UploadModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  folders: VideoFolderRow[];
  defaultFolderId?: string | null;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState<string>(
    props.defaultFolderId ?? '__root__',
  );
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing'>(
    'idle',
  );

  const reset = useCallback(() => {
    setFile(null);
    setTitle('');
    setFolderId(props.defaultFolderId ?? '__root__');
    setProgress(0);
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

  const canSubmit = Boolean(file && title.trim() && phase === 'idle');

  const submit = async () => {
    if (!file) return;

    setPhase('uploading');
    setProgress(0);

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

      const tusCreate = await fetch(tusEndpoint, {
        method: 'POST',
        headers: {
          AuthorizationSignature: signature,
          AuthorizationExpire: String(expiry),
          LibraryId: libraryId,
          VideoId: bunnyVideoId,
          'Upload-Length': String(file.size),
          'Tus-Resumable': '1.0.0',
          'Upload-Metadata': `filetype ${btoa(file.type || 'video/mp4')},title ${btoa(title.trim())}`,
        },
      });

      if (!tusCreate.ok) {
        throw new Error(`Upload session failed (${tusCreate.status})`);
      }

      const patchUrl = tusCreate.headers.get('Location');
      if (!patchUrl) {
        throw new Error('Upload session did not return a location');
      }

      await uploadWithProgress(
        patchUrl,
        file,
        {
          'Content-Type': 'application/offset+octet-stream',
          'Upload-Offset': '0',
          'Tus-Resumable': '1.0.0',
        },
        setProgress,
      );

      await fetch(`/api/videos/${videoId}/status`, { method: 'POST' });

      setPhase('processing');
      setProgress(100);

      const finalStatus = await pollVideoStatus(videoId);
      if (finalStatus === 'ready') {
        toast.success('Video uploaded and ready');
      } else {
        toast.error('Video encoding failed');
      }

      props.onOpenChange(false);
      reset();
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
      setPhase('idle');
      setProgress(0);
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
        if (!open) reset();
        props.onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-lg border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <DialogHeader>
          <DialogTitle>Upload video</DialogTitle>
          <DialogDescription>
            Upload a video file to Bunny Stream. Encoding continues in the
            background after upload.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-xl border border-dashed px-4 py-8 text-center transition ${
              isDragActive
                ? 'border-[var(--keel-teal)]/60 bg-[var(--keel-teal)]/10'
                : 'border-white/15 bg-black/20 hover:border-white/25'
            }`}
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
              disabled={phase !== 'idle'}
            />
          </div>

          <div className="space-y-2">
            <Label>Folder</Label>
            <Select
              value={folderId}
              onValueChange={setFolderId}
              disabled={phase !== 'idle'}
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
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {phase === 'uploading' ? 'Uploading…' : 'Processing…'}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/30">
                <div
                  className="h-full rounded-full bg-[var(--keel-teal)] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => props.onOpenChange(false)}
            disabled={phase === 'uploading'}
          >
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={submit}>
            {phase === 'idle' ? 'Upload' : 'Uploading…'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
