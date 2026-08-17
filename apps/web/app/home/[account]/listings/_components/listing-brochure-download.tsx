'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { Download, LayoutTemplate, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import {
  BROCHURE_TEMPLATE_OPTIONS,
  type BrochureOrientation,
  type BrochureTemplateId,
} from '~/lib/commercial/brochure-pdf/brochure-document';

type ListingBrochureDownloadProps = {
  listingId: string;
  accountId: string;
  accountSlug: string;
  className?: string;
  compact?: boolean;
};

export function ListingBrochureDownload({
  listingId,
  accountId,
  accountSlug,
  className,
  compact = false,
}: ListingBrochureDownloadProps) {
  const [orientation, setOrientation] =
    useState<BrochureOrientation>('portrait');
  const [templateId, setTemplateId] =
    useState<BrochureTemplateId>('classic');
  const [pending, startTransition] = useTransition();

  const editorHref = `${pathsConfig.app.accountListingDetail
    .replace('[account]', accountSlug)
    .replace('[id]', listingId)}/brochure`;

  function download(useSaved: boolean) {
    startTransition(async () => {
      try {
        const params = new URLSearchParams({
          listingId,
          accountId,
          orientation,
          template: templateId,
        });
        if (useSaved) params.set('useSaved', '1');

        const res = await fetch(`/api/listings/brochure-pdf?${params}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? 'Could not generate PDF');
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download =
          res.headers
            .get('Content-Disposition')
            ?.match(/filename="([^"]+)"/)?.[1] ?? 'brochure.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not download brochure',
        );
      }
    });
  }

  return (
    <div className={className}>
      {!compact ? (
        <p className="mb-3 text-sm text-[var(--workspace-shell-text)]/60">
          Download a designed A4 PDF brochure, or open the page editor to refine
          layouts.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="grid gap-1.5">
          <Label className="text-xs text-[var(--workspace-shell-text)]/60">
            Orientation
          </Label>
          <Select
            value={orientation}
            onValueChange={(v) => setOrientation(v as BrochureOrientation)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">Portrait (particulars)</SelectItem>
              <SelectItem value="landscape">
                Landscape (offering memo)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs text-[var(--workspace-shell-text)]/60">
            Template
          </Label>
          <Select
            value={templateId}
            onValueChange={(v) => setTemplateId(v as BrochureTemplateId)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BROCHURE_TEMPLATE_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => download(false)}
            className="gap-1.5"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            asChild
            className="gap-1.5"
          >
            <Link href={editorHref}>
              <LayoutTemplate className="h-3.5 w-3.5" />
              Edit pages
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
