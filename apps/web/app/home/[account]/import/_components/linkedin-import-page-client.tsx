'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import {
  ArrowLeft,
  BriefcaseBusiness,
  Loader2,
  Upload,
  Users,
} from 'lucide-react';

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

import pathsConfig from '~/config/paths.config';
import { parseCsv } from '~/lib/csv/parse-csv';
import {
  isLinkedInConnectionsCsv,
  type LinkedInImportDestination,
} from '~/lib/integrations/linkedin/linkedin-import';

import {
  commitLinkedInImportAction,
  previewLinkedInImportAction,
} from '../_lib/server/linkedin-import-actions';
import { LinkedInExportInstructions } from './linkedin-export-instructions';

type Step = 'setup' | 'upload' | 'preview' | 'duplicates' | 'done';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

const PIPELINE_STAGES = [
  { value: 'lead', label: 'Lead' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'call_booked', label: 'Call Booked' },
];

function parseInitialDestination(
  value: string | null,
): LinkedInImportDestination {
  return value === 'pipeline' ? 'pipeline' : 'clients';
}

export function LinkedInImportPageClient({
  accountId,
  accountSlug,
  canImportClients = true,
  canImportPipeline = true,
}: {
  accountId: string;
  accountSlug: string;
  canImportClients?: boolean;
  canImportPipeline?: boolean;
}) {
  const searchParams = useSearchParams();
  const requestedDestination = parseInitialDestination(
    searchParams.get('destination'),
  );
  const initialDestination =
    requestedDestination === 'pipeline' && canImportPipeline
      ? 'pipeline'
      : canImportClients
        ? 'clients'
        : 'pipeline';

  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>('setup');
  const [destination, setDestination] =
    useState<LinkedInImportDestination>(initialDestination);
  const [stage, setStage] = useState('lead');
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<
    Array<{
      id: string;
      label: string;
      detail?: string;
      errors: string[];
      warnings?: string[];
    }>
  >([]);
  const [duplicateRows, setDuplicateRows] = useState<
    Array<{
      id: string;
      incomingLabel: string;
      existingLabel: string;
      matchReason: string;
    }>
  >([]);
  const [duplicateActions, setDuplicateActions] = useState<
    Record<string, 'keep' | 'overwrite' | 'create_new'>
  >({});
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [resultSummary, setResultSummary] = useState<string | null>(null);

  const backHref =
    destination === 'pipeline'
      ? pathsConfig.app.accountPipeline.replace('[account]', accountSlug)
      : pathsConfig.app.accountClients.replace('[account]', accountSlug);

  const title = useMemo(
    () =>
      destination === 'pipeline'
        ? 'Import LinkedIn to pipeline'
        : 'Import LinkedIn to clients',
    [destination],
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

      if (!isLinkedInConnectionsCsv(parsed.headers)) {
        setError(
          'This does not look like a LinkedIn Connections.csv export. Export from LinkedIn Settings → Data privacy → Get a copy of your data → Connections.',
        );
        return;
      }

      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      startTransition(async () => {
        try {
          const result = await previewLinkedInImportAction({
            accountId,
            destination,
            headers: parsed.headers,
            rows: parsed.rows,
            stage,
          });
          setPreviewRows(result.previewRows);
          setDuplicateRows(result.duplicateRows);
          setValidCount(result.validCount);
          setErrorCount(result.errorCount);
          setDuplicateActions(
            Object.fromEntries(
              result.duplicateRows.map((row) => [row.id, 'keep' as const]),
            ),
          );
          setStep('preview');
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Could not preview import',
          );
        }
      });
    };
    reader.readAsText(file);
  };

  const runCommit = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await commitLinkedInImportAction({
          accountId,
          accountSlug,
          destination,
          headers,
          rows,
          stage,
          duplicateActions,
        });

        const parts = [
          result.imported ? `${result.imported} imported` : null,
          result.updated ? `${result.updated} updated` : null,
          result.skipped ? `${result.skipped} skipped` : null,
          result.failed.length ? `${result.failed.length} failed` : null,
        ].filter(Boolean);

        setResultSummary(
          parts.length
            ? `Import complete: ${parts.join(', ')}.`
            : 'Nothing was imported.',
        );
        setStep('done');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import failed');
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
            Export your connections from LinkedIn, then upload Connections.csv
            to create CRM clients or pipeline leads.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {step === 'setup' ? (
        <div className={cn(panelClass, 'space-y-5 p-5')}>
          <div className="space-y-2">
            <Label className="text-[var(--workspace-shell-text)]">
              Import into
            </Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {canImportClients ? (
                <button
                  type="button"
                  onClick={() => setDestination('clients')}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors',
                    destination === 'clients'
                      ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent)]/10'
                      : 'border-[color:var(--workspace-shell-border)] hover:bg-[var(--workspace-shell-sidebar-accent)]',
                  )}
                >
                  <Users className="mb-2 h-5 w-5 text-[var(--ozer-accent)]" />
                  <p className="font-medium text-[var(--workspace-shell-text)]">
                    Clients (CRM)
                  </p>
                  <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                    Create client records with contacts for people you already
                    know or work with.
                  </p>
                </button>
              ) : null}
              {canImportPipeline ? (
                <button
                  type="button"
                  onClick={() => setDestination('pipeline')}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors',
                    destination === 'pipeline'
                      ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent)]/10'
                      : 'border-[color:var(--workspace-shell-border)] hover:bg-[var(--workspace-shell-sidebar-accent)]',
                  )}
                >
                  <BriefcaseBusiness className="mb-2 h-5 w-5 text-[var(--ozer-accent)]" />
                  <p className="font-medium text-[var(--workspace-shell-text)]">
                    Pipeline (leads)
                  </p>
                  <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                    Add prospects as deals at an early stage so you can qualify
                    them later.
                  </p>
                </button>
              ) : null}
            </div>
          </div>

          {destination === 'pipeline' ? (
            <div className="space-y-2">
              <Label htmlFor="linkedin-stage">Starting stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger
                  id="linkedin-stage"
                  className="max-w-xs border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <LinkedInExportInstructions />

          <div className="flex justify-end">
            <Button
              type="button"
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              onClick={() => setStep('upload')}
            >
              Continue to upload
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'upload' ? (
        <div className="space-y-4">
          <LinkedInExportInstructions compact />
          <div className={cn(panelClass, 'p-8 text-center')}>
          <Upload className="mx-auto mb-3 h-8 w-8 text-[var(--ozer-accent-muted)]" />
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Upload Connections.csv
          </p>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
            Importing into{' '}
            {destination === 'pipeline' ? 'pipeline leads' : 'clients'}
          </p>
          <div className="mt-4">
            <Label
              htmlFor="linkedin-csv-upload"
              className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[var(--ozer-accent)] px-4 py-2 text-sm font-medium text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
            >
              Choose file
            </Label>
          </div>
          <input
            id="linkedin-csv-upload"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              className="border-[color:var(--workspace-shell-border)]"
              onClick={() => setStep('setup')}
            >
              Back
            </Button>
          </div>
          </div>
        </div>
      ) : null}

      {step === 'preview' ? (
        <div className={cn(panelClass, 'space-y-4 p-5')}>
          <div>
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Preview · {validCount} ready
              {errorCount > 0 ? ` · ${errorCount} with errors` : ''}
              {fileName ? ` · ${fileName}` : ''}
            </p>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Showing first {Math.min(previewRows.length, 25)} of{' '}
              {previewRows.length} connections
            </p>
          </div>

          <div className="max-h-80 overflow-auto rounded-xl border border-[color:var(--workspace-shell-border)]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Connection</th>
                  <th className="px-3 py-2 font-medium">Details</th>
                  <th className="px-3 py-2 font-medium">Status</th>
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
              onClick={() => setStep('upload')}
              className="border-[color:var(--workspace-shell-border)]"
            >
              Back
            </Button>
            {duplicateRows.length > 0 ? (
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
                Import {validCount} connections
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
                    destination === 'clients'
                      ? ([
                          ['keep', 'Keep existing'],
                          ['overwrite', 'Overwrite'],
                          ['create_new', 'Import as new'],
                        ] as const)
                      : ([
                          ['keep', 'Keep existing'],
                          ['create_new', 'Import as new'],
                        ] as const)
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
            <Link href={backHref}>
              Back to {destination === 'pipeline' ? 'pipeline' : 'clients'}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
