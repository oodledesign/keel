'use client';

import { useMemo, useState } from 'react';

import {
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  Sheet,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  DEFAULT_EXPORT_OPTIONS,
  type DisposalsExportOptions,
  type ExportFormat,
  type ExportTextTable,
  renderExportHtml,
} from '~/lib/commercial/disposals-export';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import {
  DisposalsExportFields,
  type ExportOffice,
  cleanExportOptions,
  exportSectionTitle as sectionTitle,
} from './disposals-export-fields';

type Action = ExportFormat | 'print';

const STORAGE_PREFIX = 'keel.disposals-export.v1.';

function readSaved(
  accountId: string,
  officeIds: Set<string>,
): DisposalsExportOptions | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + accountId);
    return raw ? cleanExportOptions(JSON.parse(raw), officeIds) : null;
  } catch {
    return null;
  }
}

function printHtml(html: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  // Static markup only: no scripts, but printing needs modals.
  frame.setAttribute('sandbox', 'allow-modals allow-same-origin');
  frame.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 60_000);
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function DisposalsExportDialog({
  accountId,
  offices,
  open,
  onOpenChange,
}: {
  accountId: string;
  offices: ExportOffice[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [options, setOptions] = useState<DisposalsExportOptions>(
    DEFAULT_EXPORT_OPTIONS,
  );
  const [busy, setBusy] = useState<Action | null>(null);

  const officeIdSet = useMemo(
    () => new Set(offices.map((office) => office.id)),
    [offices],
  );

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setOptions(readSaved(accountId, officeIdSet) ?? DEFAULT_EXPORT_OPTIONS);
    }
    onOpenChange(next);
  };

  const update = (patch: Partial<DisposalsExportOptions>) =>
    setOptions((current) => ({ ...current, ...patch }));

  const canExport =
    options.columns.length > 0 && options.statuses.length > 0 && !busy;

  const run = async (action: Action) => {
    setBusy(action);
    try {
      const response = await fetch('/api/disposals/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          format: action === 'print' ? 'json' : action,
          options,
        }),
      });

      if (!response.ok) {
        const message = (await response.text()).trim();
        throw new Error(
          message && message.length < 200
            ? message
            : 'Could not build the export',
        );
      }

      if (action === 'print') {
        const table = (await response.json()) as ExportTextTable;
        printHtml(renderExportHtml(table));
      } else {
        const disposition = response.headers.get('Content-Disposition') ?? '';
        const filename =
          /filename="([^"]+)"/.exec(disposition)?.[1] ??
          `availability-schedule.${action}`;
        saveBlob(await response.blob(), filename);
      }

      try {
        window.localStorage.setItem(
          STORAGE_PREFIX + accountId,
          JSON.stringify(options),
        );
      } catch {
        // Remembering the choices is a convenience only.
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not build the export',
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0"
        data-test="disposals-export-dialog"
      >
        <DialogHeader className="border-b border-[color:var(--workspace-shell-border)] px-6 py-4">
          <DialogTitle className="text-[var(--workspace-shell-text)]">
            Export disposals
          </DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            Choose the columns, offices and statuses, then print it or download
            it. Your choices are remembered for next time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto px-6 py-5">
          <DisposalsExportFields
            options={options}
            offices={offices}
            onChange={setOptions}
            extra={
              <section className="space-y-2">
                <h3 className={sectionTitle}>Changes</h3>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="export-compare"
                    checked={options.compareToLast}
                    onCheckedChange={(checked) =>
                      update({ compareToLast: checked === true })
                    }
                  />
                  <Label
                    htmlFor="export-compare"
                    className="cursor-pointer text-sm leading-snug font-normal text-[var(--workspace-shell-text)]"
                  >
                    Mark what has changed since my last export
                    <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">
                      Adds a Change column and highlights new and changed
                      disposals. Compared with your last export of the same
                      offices and statuses.
                    </span>
                  </Label>
                </div>
              </section>
            }
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--workspace-shell-border)] px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={Boolean(busy)}
            onClick={() => setOptions(DEFAULT_EXPORT_OPTIONS)}
          >
            Reset
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              action="print"
              busy={busy}
              disabled={!canExport}
              icon={<Printer aria-hidden className="h-4 w-4" />}
              label="Print"
              onRun={run}
            />
            <ExportButton
              action="pdf"
              busy={busy}
              disabled={!canExport}
              icon={<FileText aria-hidden className="h-4 w-4" />}
              label="PDF"
              onRun={run}
            />
            <ExportButton
              action="csv"
              busy={busy}
              disabled={!canExport}
              icon={<Sheet aria-hidden className="h-4 w-4" />}
              label="CSV"
              onRun={run}
            />
            <ExportButton
              action="xlsx"
              busy={busy}
              disabled={!canExport}
              icon={<FileSpreadsheet aria-hidden className="h-4 w-4" />}
              label="Excel"
              primary
              onRun={run}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExportButton({
  action,
  busy,
  disabled,
  icon,
  label,
  primary = false,
  onRun,
}: {
  action: Action;
  busy: Action | null;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  onRun: (action: Action) => void;
}) {
  return (
    <Button
      type="button"
      variant={primary ? 'default' : 'outline'}
      disabled={disabled}
      className={primary ? workspaceBtnPrimaryMd : 'h-9 gap-2 rounded-xl'}
      data-test={`disposals-export-${action}`}
      onClick={() => onRun(action)}
    >
      {busy === action ? (
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
      ) : (
        icon
      )}
      {label}
    </Button>
  );
}
