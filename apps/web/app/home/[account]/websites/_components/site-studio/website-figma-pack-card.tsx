'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Check, Copy, Download, FileCode2, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { generateWebsiteFigmaPack } from '../../_lib/server/site-studio-actions';

type PackFile = { path: string; content: string };

type FigmaPageLink = {
  slug: string;
  title: string;
  importUrl: string;
};

type PackResult = {
  files: PackFile[];
  zipBase64: string | null;
  zipFilename: string;
  activePath: string | null;
  pages: FigmaPageLink[];
  pngNotes: string[];
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

export function WebsiteFigmaPackCard({
  accountId,
  websiteId,
}: {
  accountId: string;
  websiteId: string;
}) {
  const [pack, setPack] = useState<PackResult>({
    files: [],
    zipBase64: null,
    zipFilename: 'figma-bridge.zip',
    activePath: null,
    pages: [],
    pngNotes: [],
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
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

  function markCopied(key: string) {
    setCopiedKey(key);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedKey(null), 2000);
  }

  function generate() {
    startTransition(async () => {
      try {
        const result = await generateWebsiteFigmaPack({
          accountId,
          websiteId,
          capturePngs: true,
        });
        setPack({
          files: result.files,
          zipBase64: result.zipBase64,
          zipFilename: result.zipFilename,
          activePath: result.files[0]?.path ?? null,
          pages: result.pages,
          pngNotes: result.pngNotes ?? [],
        });
        toast.success(
          `Figma pack ready (${result.files.length} files · ${result.pages.length} import URLs)`,
        );
        if (result.pngNotes?.length) {
          toast.message(
            'Wireframe PNGs skipped in this environment — use import URLs with html.to.design.',
          );
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not generate Figma pack',
        );
      }
    });
  }

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      markCopied(key);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Figma
          </p>
          <p className="mt-1 max-w-2xl text-sm text-[var(--workspace-shell-text-muted)]">
            Tier 0: Tokens Studio JSON + page outline + optional wireframe PNGs.
            Tier 1: chrome-less page URLs for the{' '}
            <span className="text-[var(--workspace-shell-text)]">
              html.to.design
            </span>{' '}
            plugin — copy a URL in Figma → import → editable layers. No Figma
            plugin is built in Ozer.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={pending} onClick={generate}>
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileCode2 className="mr-2 h-4 w-4" />
            )}
            Generate Figma pack
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

      {pack.pages.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
            html.to.design — copy page URL
          </p>
          <ul className="space-y-2">
            {pack.pages.map((page) => (
              <li
                key={page.slug}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[var(--workspace-shell-text)]">
                    {page.title}
                  </p>
                  <p className="truncate font-mono text-xs text-[var(--workspace-shell-text-muted)]">
                    {page.importUrl}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 text-xs"
                  onClick={() => copyText(`url-${page.slug}`, page.importUrl)}
                >
                  {copiedKey === `url-${page.slug}` ? (
                    <Check className="mr-1 h-3 w-3" />
                  ) : (
                    <Copy className="mr-1 h-3 w-3" />
                  )}
                  {copiedKey === `url-${page.slug}`
                    ? 'Copied'
                    : 'Copy Figma import URL'}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
                  onClick={() =>
                    copyText(`file-${activeFile.path}`, activeFile.content)
                  }
                >
                  {copiedKey === `file-${activeFile.path}` ? (
                    <Check className="mr-1 h-3 w-3" />
                  ) : (
                    <Copy className="mr-1 h-3 w-3" />
                  )}
                  {copiedKey === `file-${activeFile.path}`
                    ? 'Copied'
                    : 'Copy file'}
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
          Generate to mint import URLs, preview token JSON, and download the
          bridge zip.
        </p>
      )}
    </div>
  );
}
