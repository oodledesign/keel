'use client';

import { useState } from 'react';

import { ArrowLeft, Download, Loader2, Send } from 'lucide-react';

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
import { Checkbox } from '@kit/ui/checkbox';

import {
  BROCHURE_TEMPLATE_OPTIONS,
  type BrochureOrientation,
  type BrochureTemplateId,
} from '~/lib/commercial/brochure-pdf/brochure-document';

import type {
  BrochurePreviewResult,
  BrochureWizardChannel,
} from './brochure-wizard';

function downloadBlob(url: string, filename: string) {
  const a = window.document.createElement('a');
  a.href = url;
  a.download = filename;
  window.document.body.appendChild(a);
  a.click();
  a.remove();
}

export function BrochureApproveStep({
  preview,
  doc,
  pageCount,
  approved,
  onApprovedChange,
  channels,
  busy,
  onBack,
  onPublish,
}: {
  preview: BrochurePreviewResult;
  doc: { templateId: BrochureTemplateId; orientation: BrochureOrientation };
  pageCount: number;
  approved: boolean;
  onApprovedChange: (approved: boolean) => void;
  channels: BrochureWizardChannel[];
  busy: boolean;
  onBack: () => void;
  onPublish: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const style =
    BROCHURE_TEMPLATE_OPTIONS.find((t) => t.id === doc.templateId)?.label ??
    doc.templateId;
  const liveChannels = channels.filter((c) => c.on);
  const checks = preview.warnings.length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-xl space-y-6 px-6 py-10">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
            Approve the brochure
          </h3>
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            {doc.orientation === 'landscape' ? 'Landscape' : 'Portrait'},{' '}
            {style} style, {preview.pageIds.length} of {pageCount} pages in the
            PDF.{' '}
            {checks > 0
              ? `${checks} ${checks === 1 ? 'check needs' : 'checks need'} a look.`
              : 'No problems found.'}
          </p>
        </div>

        <label
          htmlFor="brochure-approved"
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4"
        >
          <Checkbox
            id="brochure-approved"
            checked={approved}
            disabled={busy}
            onCheckedChange={(checked) => onApprovedChange(checked === true)}
            className="mt-0.5"
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium text-[var(--workspace-shell-text)]">
              I&apos;ve checked every page of the PDF
            </span>
            <span className="block text-xs text-[var(--workspace-shell-text-muted)]">
              Images, prices, contact details and the map are right.
            </span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={!approved || busy}
            onClick={() => downloadBlob(preview.url, preview.filename)}
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          <Button
            type="button"
            className="gap-2"
            disabled={!approved || busy}
            onClick={() => setConfirmOpen(true)}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Publish
          </Button>
        </div>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          Publishing saves this PDF to the listing&apos;s media and replaces any
          brochure published before, including the other orientation. Only a
          published brochure is sent to your website and portals.
        </p>

        <Button
          type="button"
          variant="ghost"
          className="gap-1.5"
          disabled={busy}
          onClick={onBack}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to the PDF
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this brochure?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {liveChannels.length > 0
                    ? 'It will be sent to:'
                    : 'No feeds are switched on for this listing yet. It will be saved to the listing and sent once a feed is on.'}
                </p>
                {liveChannels.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {liveChannels.map((c) => (
                      <li key={c.id}>{c.label}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                onPublish();
              }}
            >
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
