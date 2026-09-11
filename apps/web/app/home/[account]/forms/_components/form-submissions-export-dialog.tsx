'use client';

import { useMemo, useState } from 'react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
  RadioGroupItemLabel,
} from '@kit/ui/radio-group';
import { toast } from '@kit/ui/sonner';

import type { WorkspaceFormField } from '~/lib/workspace-forms/form-fields';
import {
  SUBMISSION_EXPORT_TABLE_COLUMN_LIMIT,
  type SubmissionExportFormat,
  type SubmissionExportMode,
  type SubmissionExportPdfLayout,
  buildSubmissionExportTable,
  buildSubmissionsExportPdf,
  listAnsweredSubmissionColumnIds,
  selectSubmissionsForExport,
  submissionsExportAttendeeSummary,
  submissionsExportFilename,
  submissionsExportToCsv,
} from '~/lib/workspace-forms/form-submissions-export';
import {
  type SubmissionColumnId,
  countRsvpAttendeeTotals,
  countSubmissionStats,
  listSubmissionColumnOptions,
} from '~/lib/workspace-forms/form-submissions-view';
import {
  workspaceBtnPrimary,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type { WorkspaceFormSubmissionRecord } from '../_lib/server/workspace-forms.service';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formName: string;
  fields: WorkspaceFormField[];
  submissions: WorkspaceFormSubmissionRecord[];
  tableColumns: SubmissionColumnId[];
  submissionsOnly: boolean;
};

type ExportDraft = {
  format: SubmissionExportFormat;
  mode: SubmissionExportMode;
  pdfLayout: SubmissionExportPdfLayout;
  columns: SubmissionColumnId[];
  pending: boolean;
};

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function pdfBytesToBlob(bytes: Uint8Array): Blob {
  // Copy into a fresh ArrayBuffer-backed view so BlobPart typing accepts it.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: 'application/pdf' });
}

export function FormSubmissionsExportDialog({
  open,
  onOpenChange,
  ...bodyProps
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <FormSubmissionsExportDialogBody
          key="open"
          onOpenChange={onOpenChange}
          {...bodyProps}
        />
      ) : null}
    </Dialog>
  );
}

function FormSubmissionsExportDialogBody({
  onOpenChange,
  formName,
  fields,
  submissions,
  tableColumns,
  submissionsOnly,
}: Omit<Props, 'open'>) {
  const options = useMemo(() => listSubmissionColumnOptions(fields), [fields]);
  const stats = useMemo(() => countSubmissionStats(submissions), [submissions]);
  const attendeeTotals = useMemo(
    () => countRsvpAttendeeTotals(fields, submissions),
    [fields, submissions],
  );
  const [draft, setDraft] = useState<ExportDraft>(() => ({
    format: 'csv',
    mode: 'all',
    pdfLayout: 'list',
    columns:
      tableColumns.length > 0
        ? tableColumns
        : options.map((option) => option.id),
    pending: false,
  }));

  const exportRows = useMemo(
    () => selectSubmissionsForExport(submissions, draft.mode),
    [draft.mode, submissions],
  );

  function setColumns(columns: SubmissionColumnId[]) {
    setDraft((current) => ({ ...current, columns }));
  }

  function toggleColumn(id: SubmissionColumnId, checked: boolean) {
    setDraft((current) => {
      if (checked) {
        if (current.columns.includes(id)) return current;
        return { ...current, columns: [...current.columns, id] };
      }
      return {
        ...current,
        columns: current.columns.filter((column) => column !== id),
      };
    });
  }

  async function download() {
    if (draft.columns.length === 0) {
      toast.error('Choose at least one field to export');
      return;
    }

    setDraft((current) => ({ ...current, pending: true }));
    try {
      const table = buildSubmissionExportTable({
        fields,
        submissions: exportRows,
        columns: draft.columns,
        submissionsOnly,
      });
      const filename = submissionsExportFilename({
        formName,
        format: draft.format,
        mode: draft.mode,
      });

      if (draft.format === 'csv') {
        downloadBlob(
          filename,
          new Blob([submissionsExportToCsv(table)], {
            type: 'text/csv;charset=utf-8',
          }),
        );
      } else {
        const bytes = await buildSubmissionsExportPdf({
          formName,
          mode: draft.mode,
          table,
          pdfLayout: draft.pdfLayout,
          attendeeTotals,
        });
        downloadBlob(filename, pdfBytesToBlob(bytes));
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not export submissions',
      );
      setDraft((current) => ({ ...current, pending: false }));
    }
  }

  return (
    <DialogContent
      className="max-h-[85vh] max-w-lg overflow-y-auto"
      data-test="submission-export-dialog"
      onPointerDownOutside={(event) => {
        if (draft.pending) event.preventDefault();
      }}
      onEscapeKeyDown={(event) => {
        if (draft.pending) event.preventDefault();
      }}
    >
      <DialogHeader>
        <DialogTitle>Export submissions</DialogTitle>
        <DialogDescription>
          Download a CSV or PDF of the submissions already loaded on this page.
          Generation happens in the browser and will not block the table.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <div className="grid gap-2">
          <Label>Format</Label>
          <RadioGroup
            value={draft.format}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                format: value as SubmissionExportFormat,
              }))
            }
            className="grid gap-2 sm:grid-cols-2"
            data-test="submission-export-format"
          >
            <RadioGroupItemLabel
              selected={draft.format === 'csv'}
              className="h-full items-start gap-3 space-x-0"
            >
              <RadioGroupItem value="csv" className="mt-0.5" />
              <span className="grid gap-0.5">
                <span className={`font-medium ${workspaceText}`}>CSV</span>
                <span className={`text-xs ${workspaceTextMuted}`}>
                  Spreadsheet of the selected columns
                </span>
              </span>
            </RadioGroupItemLabel>
            <RadioGroupItemLabel
              selected={draft.format === 'pdf'}
              className="h-full items-start gap-3 space-x-0"
            >
              <RadioGroupItem value="pdf" className="mt-0.5" />
              <span className="grid gap-0.5">
                <span className={`font-medium ${workspaceText}`}>PDF</span>
                <span className={`text-xs ${workspaceTextMuted}`}>
                  Choose table or list layout below
                </span>
              </span>
            </RadioGroupItemLabel>
          </RadioGroup>
        </div>

        {draft.format === 'pdf' ? (
          <div className="grid gap-2">
            <Label>PDF layout</Label>
            <RadioGroup
              value={draft.pdfLayout}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  pdfLayout: value as SubmissionExportPdfLayout,
                }))
              }
              className="grid gap-2 sm:grid-cols-2"
              data-test="submission-export-pdf-layout"
            >
              <RadioGroupItemLabel
                selected={draft.pdfLayout === 'list'}
                className="h-full items-start gap-3 space-x-0"
              >
                <RadioGroupItem value="list" className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span className={`font-medium ${workspaceText}`}>List</span>
                  <span className={`text-xs ${workspaceTextMuted}`}>
                    One section per submission, fields stacked
                  </span>
                </span>
              </RadioGroupItemLabel>
              <RadioGroupItemLabel
                selected={draft.pdfLayout === 'table'}
                className="h-full items-start gap-3 space-x-0"
              >
                <RadioGroupItem value="table" className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span className={`font-medium ${workspaceText}`}>Table</span>
                  <span className={`text-xs ${workspaceTextMuted}`}>
                    {draft.columns.length > SUBMISSION_EXPORT_TABLE_COLUMN_LIMIT
                      ? `Spreadsheet rows and columns. Best with ${SUBMISSION_EXPORT_TABLE_COLUMN_LIMIT} or fewer fields.`
                      : 'Spreadsheet rows and columns, matching the submissions table'}
                  </span>
                </span>
              </RadioGroupItemLabel>
            </RadioGroup>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label>Rows</Label>
          <RadioGroup
            value={draft.mode}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                mode: value as SubmissionExportMode,
              }))
            }
            className="grid gap-2"
            data-test="submission-export-mode"
          >
            <RadioGroupItemLabel
              selected={draft.mode === 'all'}
              className="h-full items-start gap-3 space-x-0"
            >
              <RadioGroupItem value="all" className="mt-0.5" />
              <span className="grid gap-0.5">
                <span className={`font-medium ${workspaceText}`}>
                  All submissions
                </span>
                <span className={`text-xs ${workspaceTextMuted}`}>
                  Every row, including repeats from the same email (
                  {stats.total})
                </span>
              </span>
            </RadioGroupItemLabel>
            <RadioGroupItemLabel
              selected={draft.mode === 'unique'}
              className="h-full items-start gap-3 space-x-0"
            >
              <RadioGroupItem value="unique" className="mt-0.5" />
              <span className="grid gap-0.5">
                <span className={`font-medium ${workspaceText}`}>Unique</span>
                <span className={`text-xs ${workspaceTextMuted}`}>
                  Same as the RSVP unique count: one row per email when an email
                  is present, otherwise each submission. Repeats keep the latest
                  response ({stats.unique})
                </span>
              </span>
            </RadioGroupItemLabel>
          </RadioGroup>
        </div>

        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Fields</Label>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setColumns(tableColumns)}
                data-test="submission-export-use-table-columns"
              >
                Table columns
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() =>
                  setColumns(
                    listAnsweredSubmissionColumnIds(
                      fields,
                      submissions,
                      submissionsOnly,
                    ),
                  )
                }
                data-test="submission-export-answered-fields"
              >
                Answered fields
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setColumns(options.map((option) => option.id))}
                data-test="submission-export-all-fields"
              >
                All fields
              </Button>
            </div>
          </div>
          <p className={`text-xs ${workspaceTextMuted}`}>
            Defaults to the columns currently shown in the table. Submitted at,
            email, and other meta fields are included when selected.
          </p>
          <div
            className="grid max-h-56 gap-1.5 overflow-y-auto pr-1"
            data-test="submission-export-fields"
          >
            {options.map((option) => {
              const checked = draft.columns.includes(option.id);
              return (
                <label
                  key={option.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      toggleColumn(option.id, value === true)
                    }
                  />
                  <span className={workspaceText}>{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <DialogFooter>
        <p className={`mr-auto text-xs ${workspaceTextMuted}`}>
          {exportRows.length} row{exportRows.length === 1 ? '' : 's'} ·{' '}
          {draft.columns.length} field{draft.columns.length === 1 ? '' : 's'}
          {attendeeTotals
            ? ` · ${submissionsExportAttendeeSummary(attendeeTotals)} (latest RSVP per email)`
            : ''}
        </p>
        <Button
          type="button"
          className={workspaceBtnPrimary}
          disabled={draft.pending || draft.columns.length === 0}
          onClick={() => {
            void download();
          }}
          data-test="submission-export-download"
        >
          {draft.pending ? 'Preparing…' : 'Download'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
