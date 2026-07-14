'use client';

import { useMemo, useState } from 'react';

import { Check, Copy, Download, FileCode2 } from 'lucide-react';

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

import type {
  WebsiteBrief,
  WebsiteSeoPageFields,
  WebsiteSitemapPage,
  WebsiteStyleSystem,
  WebsiteWireframePage,
} from '~/lib/websites/planning-types';
import {
  buildWebsiteExportPack,
  bundleExportPack,
  type WebsiteExportTarget,
} from '~/lib/websites/export';

const TARGET_OPTIONS: Array<{ value: WebsiteExportTarget; label: string }> = [
  { value: 'webflow', label: 'Webflow (Client-First 3.0)' },
  { value: 'astro', label: 'Astro starter' },
  { value: 'next', label: 'Next.js starter' },
];

export function WebsiteExportPanel({
  websiteName,
  domain,
  brief,
  sitemap,
  wireframes,
  style,
  seoPages,
}: {
  websiteName: string;
  domain: string | null;
  brief: WebsiteBrief | null;
  sitemap: WebsiteSitemapPage[];
  wireframes: WebsiteWireframePage[];
  style: WebsiteStyleSystem | null;
  seoPages: Record<string, WebsiteSeoPageFields>;
}) {
  const [target, setTarget] = useState<WebsiteExportTarget>(() => {
    const stack = brief?.stackPreference;
    if (stack === 'webflow' || stack === 'astro' || stack === 'next') {
      return stack;
    }
    return 'webflow';
  });
  const [activePath, setActivePath] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const pack = useMemo(
    () =>
      buildWebsiteExportPack(
        {
          websiteName,
          domain,
          brief,
          sitemap,
          wireframes,
          style,
          seoPages,
        },
        target,
      ),
    [brief, domain, seoPages, sitemap, style, target, websiteName, wireframes],
  );

  const activeFile =
    pack.files.find((file) => file.path === activePath) ?? pack.files[0] ?? null;

  const readiness = useMemo(() => {
    const warnings: string[] = [];
    if (sitemap.length === 0) warnings.push('No sitemap pages yet.');
    if (wireframes.length === 0) warnings.push('No wireframes yet.');
    if (!style?.locked) warnings.push('Style tokens are not locked.');
    const seoCovered = sitemap.filter((page) =>
      Boolean(seoPages[page.id]?.title),
    ).length;
    if (sitemap.length > 0 && seoCovered < sitemap.length) {
      warnings.push(
        `SEO fields set on ${seoCovered}/${sitemap.length} pages.`,
      );
    }
    return warnings;
  }, [seoPages, sitemap, style, wireframes]);

  async function copyFile(path: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  function downloadFile(path: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = path.split('/').pop() ?? 'export.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadBundle() {
    downloadFile(
      `${websiteName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-export-pack.md`,
      bundleExportPack(pack),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--workspace-shell-text)]/70">
            One export, everything a builder needs: structure, tokens, SEO, and
            prompts. Regenerated live from the current plan.
          </p>
          {readiness.length > 0 ? (
            <ul className="mt-1 space-y-0.5">
              {readiness.map((warning) => (
                <li key={warning} className="text-xs text-amber-300/90">
                  ⚠ {warning}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-emerald-400">
              Plan looks export-ready.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={target}
            onValueChange={(value) => {
              setTarget(value as WebsiteExportTarget);
              setActivePath(null);
            }}
          >
            <SelectTrigger className="w-60 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]">
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
          <Button type="button" size="sm" onClick={downloadBundle}>
            <Download className="mr-2 h-4 w-4" />
            Download pack
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="max-h-[480px] space-y-1 overflow-y-auto pr-1">
          {pack.files.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => setActivePath(file.path)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors',
                (activeFile?.path ?? '') === file.path
                  ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-text)]'
                  : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)]',
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
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 border-[color:var(--workspace-shell-border)] text-xs text-[var(--workspace-shell-text)]"
                  onClick={() => copyFile(activeFile.path, activeFile.content)}
                >
                  {copiedPath === activeFile.path ? (
                    <Check className="mr-1 h-3 w-3" />
                  ) : (
                    <Copy className="mr-1 h-3 w-3" />
                  )}
                  {copiedPath === activeFile.path ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 border-[color:var(--workspace-shell-border)] text-xs text-[var(--workspace-shell-text)]"
                  onClick={() => downloadFile(activeFile.path, activeFile.content)}
                >
                  <Download className="mr-1 h-3 w-3" />
                  Download
                </Button>
              </div>
            </div>
            <pre className="max-h-[440px] overflow-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/60 p-4 text-xs leading-relaxed text-[var(--workspace-shell-text)]/85">
              {activeFile.content}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
