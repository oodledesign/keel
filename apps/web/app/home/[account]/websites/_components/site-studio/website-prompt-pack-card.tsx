'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Check, Copy, Download, FileCode2, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import type { PromptPackTarget } from '~/lib/websites/exporters/types';

import { generateWebsitePromptPack } from '../../_lib/server/site-studio-actions';

const TARGET_OPTIONS: Array<{ value: PromptPackTarget; label: string }> = [
  { value: 'webflow', label: 'Webflow (Client-First 3.0)' },
  { value: 'astro', label: 'Astro' },
  { value: 'next', label: 'Next.js App Router' },
  { value: 'ozer_sites', label: 'ozer_sites (@kit/site-blocks-core)' },
];

type PackFile = { path: string; content: string };

type PackResult = {
  files: PackFile[];
  zipBase64: string | null;
  zipFilename: string;
  activePath: string | null;
};

function downloadBase64Zip(filename: string, base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

export function WebsitePromptPackCard({
  accountId,
  websiteId,
  defaultTarget = 'next',
}: {
  accountId: string;
  websiteId: string;
  defaultTarget?: PromptPackTarget;
}) {
  const [target, setTarget] = useState<PromptPackTarget>(defaultTarget);
  const [pack, setPack] = useState<PackResult>({
    files: [],
    zipBase64: null,
    zipFilename: 'prompt-pack.zip',
    activePath: null,
  });
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const activeFile =
    pack.files.find((file) => file.path === pack.activePath) ??
    pack.files[0] ??
    null;

  function generate() {
    startTransition(async () => {
      try {
        const result = await generateWebsitePromptPack({
          accountId,
          websiteId,
          target,
        });
        setPack({
          files: result.files,
          zipBase64: result.zipBase64,
          zipFilename: result.zipFilename,
          activePath: result.files[0]?.path ?? null,
        });
        toast.success(`Prompt pack ready (${result.files.length} files)`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not generate pack',
        );
      }
    });
  }

  async function copyFile(path: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedPath(path);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedPath(null), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Cursor / Claude prompts
          </p>
          <p className="mt-1 max-w-xl text-sm text-[var(--workspace-shell-text-muted)]">
            Contract-only prompt pack for builders. Missing style or SEO fields
            are marked “not yet defined” — never invented.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={target}
            onValueChange={(value) => {
              setTarget(value as PromptPackTarget);
              setPack({
                files: [],
                zipBase64: null,
                zipFilename: 'prompt-pack.zip',
                activePath: null,
              });
            }}
          >
            <SelectTrigger className="w-56 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGET_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" disabled={pending} onClick={generate}>
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileCode2 className="mr-2 h-4 w-4" />
            )}
            Generate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !pack.zipBase64}
            onClick={() => {
              if (pack.zipBase64) {
                downloadBase64Zip(pack.zipFilename, pack.zipBase64);
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Download .zip
          </Button>
        </div>
      </div>

      {pack.files.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
            {pack.files.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() =>
                  setPack((prev) => ({ ...prev, activePath: file.path }))
                }
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors',
                  (activeFile?.path ?? '') === file.path
                    ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-text)]'
                    : 'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-canvas)]',
                )}
              >
                <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate font-mono">{file.path}</span>
              </button>
            ))}
          </div>

          {activeFile ? (
            <div className="min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-mono text-xs text-[var(--workspace-shell-text-muted)]">
                  {activeFile.path}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => copyFile(activeFile.path, activeFile.content)}
                >
                  {copiedPath === activeFile.path ? (
                    <Check className="mr-1 h-3 w-3" />
                  ) : (
                    <Copy className="mr-1 h-3 w-3" />
                  )}
                  {copiedPath === activeFile.path ? 'Copied' : 'Copy file'}
                </Button>
              </div>
              <pre className="max-h-[400px] overflow-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/60 p-4 text-xs leading-relaxed text-[var(--workspace-shell-text)]/85">
                {activeFile.content}
              </pre>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Choose a target and generate to preview files before downloading the
          zip.
        </p>
      )}
    </div>
  );
}
