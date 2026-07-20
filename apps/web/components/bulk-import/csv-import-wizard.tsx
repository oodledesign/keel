'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import { ArrowLeft, Download, Loader2, Sparkles, Upload } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { cn } from '@kit/ui/utils';

import { parseCsv } from '~/lib/csv/parse-csv';
import {
  CSV_SKIP_FIELD,
  type CsvFieldMapping,
} from '~/lib/csv/rows-to-records';

export type CsvImportFieldOption = {
  value: string;
  label: string;
};

type Step = 'upload' | 'map' | 'preview' | 'duplicates' | 'done';

type CsvImportWizardProps = {
  title: string;
  description: string;
  backHref: string;
  fieldOptions: CsvImportFieldOption[];
  enableDuplicateReview?: boolean;
  /** Optional CSV template offered on the upload step. */
  template?: {
    filename: string;
    csv: string;
  };
  onSuggestMapping: (input: {
    headers: string[];
    sampleRows: string[][];
  }) => Promise<{
    mapping: CsvFieldMapping;
    notes?: string;
    aiUsed?: boolean;
  }>;
  onPreview: (input: {
    headers: string[];
    rows: string[][];
    mapping: CsvFieldMapping;
  }) => Promise<{
    previewRows: Array<{
      id: string;
      label: string;
      detail?: string;
      errors: string[];
      warnings?: string[];
    }>;
    duplicateRows?: Array<{
      id: string;
      incomingLabel: string;
      existingLabel: string;
      matchReason: string;
    }>;
    validCount: number;
    errorCount: number;
  }>;
  onCommit: (input: {
    headers: string[];
    rows: string[][];
    mapping: CsvFieldMapping;
    duplicateActions: Record<string, 'keep' | 'overwrite' | 'create_new'>;
  }) => Promise<{
    summary: string;
    failedCount: number;
  }>;
};

function downloadCsvTemplate(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

export function CsvImportWizard({
  title,
  description,
  backHref,
  fieldOptions,
  enableDuplicateReview = false,
  template,
  onSuggestMapping,
  onPreview,
  onCommit,
}: CsvImportWizardProps) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<CsvFieldMapping>({});
  const [mapNotes, setMapNotes] = useState<string | null>(null);
  const [aiUsed, setAiUsed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<
    Awaited<ReturnType<typeof onPreview>>['previewRows']
  >([]);
  const [duplicateRows, setDuplicateRows] = useState<
    NonNullable<Awaited<ReturnType<typeof onPreview>>['duplicateRows']>
  >([]);
  const [duplicateActions, setDuplicateActions] = useState<
    Record<string, 'keep' | 'overwrite' | 'create_new'>
  >({});
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [resultSummary, setResultSummary] = useState<string | null>(null);

  const mappedFieldCount = useMemo(
    () =>
      Object.values(mapping).filter(
        (value) => value && value !== CSV_SKIP_FIELD,
      ).length,
    [mapping],
  );

  const handleFile = (file: File | null) => {
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const parsed = parseCsv(text);
      if (!parsed.headers.length || !parsed.rows.length) {
        setError('CSV must include a header row and at least one data row.');
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(
        Object.fromEntries(parsed.headers.map((h) => [h, CSV_SKIP_FIELD])),
      );
      setStep('map');
      startTransition(async () => {
        try {
          const suggestion = await onSuggestMapping({
            headers: parsed.headers,
            sampleRows: parsed.rows.slice(0, 5),
          });
          setMapping(suggestion.mapping);
          setMapNotes(suggestion.notes ?? null);
          setAiUsed(suggestion.aiUsed !== false);
        } catch {
          setError('Could not suggest column mappings.');
        }
      });
    };
    reader.readAsText(file);
  };

  const runPreview = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onPreview({ headers, rows, mapping });
        setPreviewRows(result.previewRows);
        setDuplicateRows(result.duplicateRows ?? []);
        setValidCount(result.validCount);
        setErrorCount(result.errorCount);
        setDuplicateActions(
          Object.fromEntries(
            (result.duplicateRows ?? []).map((row) => [
              row.id,
              'keep' as const,
            ]),
          ),
        );
        setStep('preview');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Preview failed');
      }
    });
  };

  const runCommit = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onCommit({
          headers,
          rows,
          mapping,
          duplicateActions,
        });
        setResultSummary(result.summary);
        setStep('done');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Import failed');
      }
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={backHref}
            className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--workspace-shell-text)]">
            {title}
          </h1>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            {description}
          </p>
        </div>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          Step:{' '}
          {step === 'upload'
            ? '1. Upload'
            : step === 'map'
              ? '2. Map columns'
              : step === 'preview'
                ? '3. Preview'
                : step === 'duplicates'
                  ? '4. Duplicates'
                  : 'Done'}
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {step === 'upload' ? (
        <div className={cn(panelClass, 'p-8 text-center')}>
          <Upload className="mx-auto mb-3 h-8 w-8 text-[var(--ozer-accent-muted)]" />
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Upload a CSV file
          </p>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
            Export from Sheets or Excel as CSV. Excel files are not supported.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {template ? (
              <Button
                type="button"
                variant="outline"
                className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)]"
                onClick={() =>
                  downloadCsvTemplate(template.filename, template.csv)
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Download template
              </Button>
            ) : null}
            <Label
              htmlFor="csv-upload"
              className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[var(--ozer-accent)] px-4 py-2 text-sm font-medium text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
            >
              Choose file
            </Label>
          </div>
          <input
            id="csv-upload"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </div>
      ) : null}

      {step === 'map' ? (
        <div className={cn(panelClass, 'space-y-4 p-5')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                Map columns {fileName ? `· ${fileName}` : ''}
              </p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                {mappedFieldCount} fields mapped
                {mapNotes ? ` · ${mapNotes}` : ''}
                {!aiUsed ? ' · AI unavailable — heuristic mapping used' : ''}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              className="border-[color:var(--workspace-shell-border)]"
              onClick={() =>
                startTransition(async () => {
                  const suggestion = await onSuggestMapping({
                    headers,
                    sampleRows: rows.slice(0, 5),
                  });
                  setMapping(suggestion.mapping);
                  setMapNotes(suggestion.notes ?? null);
                  setAiUsed(suggestion.aiUsed !== false);
                })
              }
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Re-suggest with AI
            </Button>
          </div>

          <div className="space-y-3">
            {headers.map((header) => (
              <div
                key={header}
                className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center"
              >
                <div>
                  <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                    {header}
                  </p>
                  <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                    e.g. {rows[0]?.[headers.indexOf(header)] || '—'}
                  </p>
                </div>
                <Select
                  value={mapping[header] ?? CSV_SKIP_FIELD}
                  onValueChange={(value) =>
                    setMapping((prev) => ({ ...prev, [header]: value }))
                  }
                >
                  <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('upload')}
              className="border-[color:var(--workspace-shell-border)]"
            >
              Back
            </Button>
            <Button
              type="button"
              disabled={pending || mappedFieldCount === 0}
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              onClick={runPreview}
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Preview
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'preview' ? (
        <div className={cn(panelClass, 'space-y-4 p-5')}>
          <div>
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Preview · {validCount} ready
              {errorCount > 0 ? ` · ${errorCount} with errors` : ''}
            </p>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Showing first {Math.min(previewRows.length, 25)} of{' '}
              {previewRows.length} rows
            </p>
          </div>

          <div className="max-h-80 overflow-auto rounded-xl border border-[color:var(--workspace-shell-border)]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Details</th>
                  <th className="px-3 py-2 font-medium">Issues</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 25).map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[color:var(--workspace-shell-border)]"
                  >
                    <td className="px-3 py-2 align-top text-[var(--workspace-shell-text)]">
                      {row.label}
                    </td>
                    <td className="px-3 py-2 align-top text-[var(--workspace-shell-text-muted)]">
                      {row.detail || '—'}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {row.errors.length ? (
                        <span className="text-red-500">
                          {row.errors.join('; ')}
                        </span>
                      ) : row.warnings?.length ? (
                        <span className="text-amber-600">
                          {row.warnings.join('; ')}
                        </span>
                      ) : (
                        <span className="text-emerald-600">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('map')}
              className="border-[color:var(--workspace-shell-border)]"
            >
              Back
            </Button>
            {enableDuplicateReview && duplicateRows.length > 0 ? (
              <Button
                type="button"
                className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                onClick={() => setStep('duplicates')}
              >
                Review duplicates ({duplicateRows.length})
              </Button>
            ) : (
              <Button
                type="button"
                disabled={pending || validCount === 0}
                className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                onClick={runCommit}
              >
                {pending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Import {validCount} rows
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {step === 'duplicates' ? (
        <div className={cn(panelClass, 'space-y-4 p-5')}>
          <div>
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Duplicate review
            </p>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Choose keep existing, overwrite, or import as new for each match.
            </p>
          </div>

          <div className="space-y-3">
            {duplicateRows.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-[color:var(--workspace-shell-border)] p-3"
              >
                <p className="text-sm text-[var(--workspace-shell-text)]">
                  Incoming: <strong>{row.incomingLabel}</strong>
                </p>
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  Existing: {row.existingLabel} ({row.matchReason})
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  {(
                    [
                      ['keep', 'Keep existing'],
                      ['overwrite', 'Overwrite'],
                      ['create_new', 'Import as new'],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className="inline-flex items-center gap-1.5 text-[var(--workspace-shell-text)]"
                    >
                      <input
                        type="radio"
                        name={`dup-${row.id}`}
                        checked={(duplicateActions[row.id] ?? 'keep') === value}
                        onChange={() =>
                          setDuplicateActions((prev) => ({
                            ...prev,
                            [row.id]: value,
                          }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('preview')}
              className="border-[color:var(--workspace-shell-border)]"
            >
              Back
            </Button>
            <Button
              type="button"
              disabled={pending}
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              onClick={runCommit}
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Import
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'done' ? (
        <div className={cn(panelClass, 'space-y-4 p-8 text-center')}>
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            {resultSummary}
          </p>
          <Button
            asChild
            className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
          >
            <Link href={backHref}>Back to list</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
