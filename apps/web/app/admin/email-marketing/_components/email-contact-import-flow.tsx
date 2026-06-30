'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Loader2, Sparkles, Upload } from 'lucide-react';
import Papa from 'papaparse';
import { useTranslation } from 'react-i18next';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';

import {
  countEmailContactRowsMissingRequired,
  isEmailContactImportMappingComplete,
} from '../_lib/email-contact-import-mapping';
import {
  EMAIL_CONTACT_IMPORT_FIELD_KEYS,
  type EmailContactImportMappingValue,
} from '../_lib/email-contact-import.schema';
import {
  importBetaUsersFromCsv,
  importContactsFromCsv,
  suggestBetaUserImportMappings,
  suggestContactImportMappings,
  type ImportEmailContactsResult,
} from '../_lib/server/email-marketing.actions';

function asToastText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Error) return value.message || fallback;
  return fallback || 'Something went wrong';
}

function isSafeRecordKey(key: string): boolean {
  return key !== '__proto__' && key !== 'constructor' && key !== 'prototype';
}

function sanitizeMapping(
  mapping: Record<string, EmailContactImportMappingValue>,
): Record<string, EmailContactImportMappingValue> {
  const out: Record<string, EmailContactImportMappingValue> = {};
  for (const [key, value] of Object.entries(mapping)) {
    if (!isSafeRecordKey(key)) continue;
    out[key] = value;
  }
  return out;
}

function sanitizeRows(rows: Record<string, string>[]): Record<string, string>[] {
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!isSafeRecordKey(key)) continue;
      out[key] = value;
    }
    return out;
  });
}

function cloneImportResult(result: ImportEmailContactsResult): ImportEmailContactsResult {
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(result);
    }
  } catch {
    // fall through
  }
  return JSON.parse(JSON.stringify(result)) as ImportEmailContactsResult;
}

const MAPPING_OPTIONS: { value: EmailContactImportMappingValue; labelKey: string }[] =
  [
    { value: '__skip__', labelKey: 'clientImportDontImport' },
    { value: 'first_name', labelKey: 'clientImportFieldFirstName' },
    { value: 'last_name', labelKey: 'clientImportFieldLastName' },
    { value: 'email', labelKey: 'clientImportFieldEmail' },
    { value: 'trade', labelKey: 'emailContactImportFieldTrade' },
    { value: 'notes', labelKey: 'clientImportFieldNotes' },
    { value: 'subscribed', labelKey: 'emailContactImportFieldSubscribed' },
  ];

function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!key) continue;
    out[key] = value == null ? '' : String(value);
  }
  return out;
}

function initialMapping(headers: string[]): Record<string, EmailContactImportMappingValue> {
  return Object.fromEntries(headers.map((header) => [header, '__skip__' as const]));
}

function mappingIssue(
  mapping: Record<string, EmailContactImportMappingValue>,
): 'duplicate' | 'identity' | null {
  const targets = Object.values(mapping).filter((target) => target !== '__skip__');
  const counts = new Map<string, number>();
  for (const target of targets) {
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  for (const count of counts.values()) {
    if (count > 1) return 'duplicate';
  }
  const hasFirst = targets.includes('first_name');
  const hasLast = targets.includes('last_name');
  const hasEmail = targets.includes('email');
  if (!(hasFirst && hasLast && hasEmail)) return 'identity';
  return null;
}

type EmailContactImportFlowProps = {
  onImported?: () => void;
  onClose?: () => void;
  active?: boolean;
  contactSource?: 'imported' | 'beta';
  importMode?: 'contacts' | 'beta_users';
  defaultMarkPrepaid?: boolean;
  customListId?: string | null;
};

export function EmailContactImportFlow({
  onImported,
  onClose,
  active = true,
  contactSource = 'imported',
  importMode = 'contacts',
  defaultMarkPrepaid = false,
  customListId = null,
}: EmailContactImportFlowProps) {
  const { t } = useTranslation('account');
  const [step, setStep] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<
    Record<string, EmailContactImportMappingValue>
  >({});
  const [aiSuggestedHeaders, setAiSuggestedHeaders] = useState<Set<string>>(
    () => new Set(),
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [markPrepaid, setMarkPrepaid] = useState(defaultMarkPrepaid);
  const [result, setResult] = useState<ImportEmailContactsResult | null>(null);

  const previewRows = useMemo(() => allRows.slice(0, 10), [allRows]);

  const reset = useCallback(() => {
    setStep(0);
    setParseError(null);
    setHeaders([]);
    setAllRows([]);
    setMapping({});
    setAiSuggestedHeaders(new Set());
    setAiLoading(false);
    setImporting(false);
    setMarkPrepaid(defaultMarkPrepaid);
    setResult(null);
  }, [defaultMarkPrepaid]);

  useEffect(() => {
    if (active) reset();
  }, [active, reset]);

  const onFile = (file: File | null) => {
    setParseError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError(asToastText(t('clientImportInvalidCsv')));
      return;
    }

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => String(header ?? '').trim(),
      complete: (res) => {
        const errs = res.errors?.filter((error) => error.type !== 'Quotes') ?? [];
        if (errs.length > 0) {
          setParseError(asToastText(t('clientImportInvalidCsv')));
          return;
        }
        const fields = (res.meta.fields ?? []).filter(
          (field): field is string => Boolean(field && String(field).trim()),
        );
        if (fields.length === 0) {
          setParseError(asToastText(t('clientImportInvalidCsv')));
          return;
        }
        const rows = (res.data ?? [])
          .map((row) => normalizeRow(row as Record<string, unknown>))
          .filter((row) => fields.some((field) => (row[field] ?? '').trim() !== ''));

        setHeaders(fields);
        setAllRows(rows);
        setMapping(initialMapping(fields));
        setAiSuggestedHeaders(new Set());
      },
      error: () => setParseError(asToastText(t('clientImportInvalidCsv'))),
    });
  };

  const handleMapWithAi = async () => {
    if (headers.length === 0) return;
    setAiLoading(true);
    try {
      const res =
        importMode === 'beta_users'
          ? await suggestBetaUserImportMappings({
              headers,
              sampleRows: sanitizeRows(previewRows),
            })
          : await suggestContactImportMappings({
              headers,
              sampleRows: sanitizeRows(previewRows),
            });

      if (!res || typeof res !== 'object') {
        toast.error(asToastText(t('clientImportAiUnavailable')));
        return;
      }

      if ('ok' in res && res.ok === false) {
        toast.error(asToastText(t('clientImportAiUnavailable')));
        return;
      }

      if (!('ok' in res) || res.ok !== true || !res.suggestions) {
        toast.error(asToastText(t('clientImportAiUnavailable')));
        return;
      }

      const next = { ...mapping };
      const badges = new Set<string>();
      for (const header of headers) {
        const suggestion = res.suggestions[header];
        if (suggestion && EMAIL_CONTACT_IMPORT_FIELD_KEYS.includes(suggestion)) {
          next[header] = suggestion;
          badges.add(header);
        }
      }
      setMapping(next);
      setAiSuggestedHeaders(badges);
    } catch {
      toast.error(asToastText(t('clientImportAiUnavailable')));
    } finally {
      setAiLoading(false);
    }
  };

  const updateMapping = (header: string, value: EmailContactImportMappingValue) => {
    setMapping((current) => ({ ...current, [header]: value }));
    setAiSuggestedHeaders((previous) => {
      const next = new Set(previous);
      next.delete(header);
      return next;
    });
  };

  const runImport = async () => {
    setImporting(true);
    try {
      const res = await importMode === 'beta_users'
        ? await importBetaUsersFromCsv({
            mapping: sanitizeMapping(mapping),
            rows: sanitizeRows(allRows),
          })
        : await importContactsFromCsv({
            mapping: sanitizeMapping(mapping),
            rows: sanitizeRows(allRows),
            source: contactSource,
            customListId: customListId ?? undefined,
          });
      setResult(cloneImportResult(res as ImportEmailContactsResult));
      setStep(3);
      toast.success(
        `${asToastText(t('clientImportImported', { count: res.imported }))}${
          res.skipped.length
            ? ` · ${asToastText(t('clientImportSkipped', { count: res.skipped.length }))}`
            : ''
        }`,
      );
      onImported?.();
    } catch (error) {
      toast.error(
        asToastText(error instanceof Error ? error.message : null, 'Import failed'),
      );
    } finally {
      setImporting(false);
    }
  };

  const missingCount = useMemo(
    () => countEmailContactRowsMissingRequired(allRows, mapping),
    [allRows, mapping],
  );

  const mappingOk = isEmailContactImportMappingComplete(mapping);
  const issue = mappingIssue(mapping);

  const stepDescription =
    step === 0
      ? t('clientImportUploadHint')
      : step === 1
        ? t('clientImportMapDescription')
        : step === 2
          ? t('clientImportReviewTitle')
          : t('clientImportDoneTitle');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="mb-4 text-sm text-[var(--workspace-shell-text-muted)]">{stepDescription}</p>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {step === 0 && (
          <div className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40 px-6 py-10 transition hover:border-emerald-600/50 hover:bg-[var(--workspace-shell-panel)]/60">
              <Upload className="mb-2 h-8 w-8 text-[var(--workspace-shell-text-muted)]" />
              <span className="text-sm text-[var(--workspace-shell-text-muted)]">{t('clientImportUploadHint')}</span>
              <input
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={(event) => onFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {parseError && <p className="text-sm text-red-400">{parseError}</p>}
            {headers.length > 0 && (
              <>
                <div className="flex flex-wrap gap-4 text-sm text-[var(--workspace-shell-text-muted)]">
                  <span>{t('clientImportColumns', { count: headers.length })}</span>
                  <span>{t('clientImportRows', { count: allRows.length })}</span>
                </div>
                <p className="text-sm font-medium text-[var(--workspace-shell-text-muted)]">{t('clientImportPreview')}</p>
                <div className="overflow-x-auto rounded-md border border-[color:var(--workspace-shell-border)]">
                  <table className="w-full min-w-[480px] text-left text-xs text-[var(--workspace-shell-text)]">
                    <thead className="bg-[var(--workspace-shell-panel)]/80 text-[var(--workspace-shell-text-muted)]">
                      <tr>
                        {headers.map((header) => (
                          <th key={header} className="px-2 py-2 font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, index) => (
                        <tr
                          key={index}
                          className="border-t border-[color:var(--workspace-shell-border)] odd:bg-[var(--workspace-shell-panel)]/40"
                        >
                          {headers.map((header) => (
                            <td key={header} className="max-w-[200px] truncate px-2 py-1.5">
                              {row[header] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={aiLoading || headers.length === 0}
                onClick={() => void handleMapWithAi()}
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/50 text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-control-surface)]"
              >
                {aiLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4 text-amber-400" />
                )}
                {aiLoading ? t('clientImportAiMapping') : t('clientImportMapWithAi')}
              </Button>
            </div>
            {issue === 'duplicate' && (
              <p className="text-sm text-amber-400">{t('clientImportMappingInvalid')}</p>
            )}
            {issue === 'identity' && (
              <p className="text-sm text-amber-400">{t('clientImportMappingInvalid')}</p>
            )}
            {!mappingOk && !issue && (
              <p className="text-sm text-amber-400">{t('clientImportMappingRequiredHint')}</p>
            )}
            <div className="overflow-x-auto rounded-md border border-[color:var(--workspace-shell-border)]">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-[var(--workspace-shell-panel)]/80 text-xs text-[var(--workspace-shell-text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('clientImportCsvColumn')}</th>
                    <th className="px-3 py-2 font-medium">{t('clientImportTradewaysField')}</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((header) => (
                    <tr key={header} className="border-t border-[color:var(--workspace-shell-border)] odd:bg-[var(--workspace-shell-panel)]/30">
                      <td className="px-3 py-2 align-middle">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[var(--workspace-shell-text)]">{header}</span>
                          {aiSuggestedHeaders.has(header) && (
                            <Badge
                              variant="secondary"
                              className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-200"
                            >
                              {t('clientImportAiSuggested')}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <select
                          className="w-full max-w-xs rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-2 py-1.5 text-sm text-[var(--workspace-shell-text)] focus-visible:ring-2 focus-visible:ring-emerald-500"
                          value={mapping[header] ?? '__skip__'}
                          onChange={(event) =>
                            updateMapping(
                              header,
                              event.target.value as EmailContactImportMappingValue,
                            )
                          }
                        >
                          {MAPPING_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {t(option.labelKey)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 text-sm text-[var(--workspace-shell-text-muted)]">
            <p>
              {t('clientImportReviewSummary', {
                total: allRows.length,
                ready: allRows.length - missingCount,
                missing: missingCount,
              })}
            </p>
            <p className="text-[var(--workspace-shell-text-muted)]">{t('clientImportDuplicateEmailHint')}</p>
            {importMode === 'beta_users' ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-4 py-3">
                <Checkbox
                  checked={markPrepaid}
                  onCheckedChange={(checked) => setMarkPrepaid(checked === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium text-[var(--workspace-shell-text)]">
                    Mark all as paid £1 (prepaid beta)
                  </span>
                  <span className="mt-1 block text-[var(--workspace-shell-text-muted)]">
                    Skips checkout on signup. Dashboard access opens 8 June 2026 for
                    three months.
                  </span>
                </span>
              </label>
            ) : null}
            <ul className="list-inside list-disc text-[var(--workspace-shell-text-muted)]">
              {Object.entries(mapping)
                .filter(([, value]) => value !== '__skip__')
                .map(([column, field]) => (
                  <li key={column}>
                    <span className="text-[var(--workspace-shell-text)]">{column}</span>
                    {' → '}
                    <span className="text-emerald-300">{field}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {step === 3 && result && (
          <div className="space-y-3 text-sm">
            <p className="text-[var(--workspace-shell-text)]">
              {t('clientImportImported', { count: result.imported })}
              {', '}
              {t('clientImportSkipped', { count: result.skipped.length })}
            </p>
            {result.skipped.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40 p-2 text-xs text-[var(--workspace-shell-text-muted)]">
                {result.skipped.slice(0, 50).map((skipped) => (
                  <div key={`${skipped.rowNumber}-${skipped.reason}`} className="py-0.5">
                    Row {skipped.rowNumber}: {skipReasonLabel(skipped.reason, t)}
                    {skipped.detail ? ` — ${skipped.detail}` : ''}
                  </div>
                ))}
                {result.skipped.length > 50 && (
                  <p className="pt-1 text-[var(--workspace-shell-text-muted)]">…and {result.skipped.length - 50} more</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--workspace-shell-border)] pt-4 sm:justify-between">
        <div className="flex gap-2">
          {step > 0 && step < 3 && (
            <Button
              type="button"
              variant="outline"
              className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              {t('clientImportBack')}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {step === 0 && (
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-500"
              disabled={headers.length === 0 || !!parseError}
              onClick={() => setStep(1)}
            >
              {t('clientImportNextMapping')}
            </Button>
          )}
          {step === 1 && (
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-500"
              disabled={!mappingOk}
              title={
                !mappingOk ? asToastText(t('clientImportMappingRequiredHint')) : undefined
              }
              onClick={() => setStep(2)}
            >
              {t('clientImportReviewTitle')}
            </Button>
          )}
          {step === 2 && (
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-500"
              disabled={importing || !mappingOk || allRows.length === 0}
              title={
                allRows.length === 0
                  ? asToastText(t('clientImportNoRowsHint'))
                  : !mappingOk
                    ? asToastText(t('clientImportMappingRequiredHint'))
                    : undefined
              }
              onClick={() => void runImport()}
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('clientImportImporting')}
                </>
              ) : (
                t('clientImportConfirm')
              )}
            </Button>
          )}
          {step === 3 && (
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-500"
              onClick={() => onClose?.()}
            >
              {t('clientImportClose')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

type EmailContactImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
  contactSource?: 'imported' | 'beta';
  importMode?: 'contacts' | 'beta_users';
  defaultMarkPrepaid?: boolean;
  customListId?: string | null;
};

export function EmailContactImportDialog({
  open,
  onOpenChange,
  onImported,
  contactSource = 'imported',
  importMode = 'contacts',
  defaultMarkPrepaid = false,
  customListId = null,
}: EmailContactImportDialogProps) {
  const { t } = useTranslation('account');
  const title =
    importMode === 'beta_users' ? 'Import beta users' : t('emailContactImportTitle');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col border border-[color:var(--workspace-control-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('clientImportUploadHint')}
          </DialogDescription>
        </DialogHeader>
        <EmailContactImportFlow
          active={open}
          onImported={onImported}
          onClose={() => onOpenChange(false)}
          contactSource={contactSource}
          importMode={importMode}
          defaultMarkPrepaid={defaultMarkPrepaid}
          customListId={customListId}
        />
      </DialogContent>
    </Dialog>
  );
}

function skipReasonLabel(reason: string, t: (key: string) => string): string {
  switch (reason) {
    case 'missing_required_fields':
      return t('clientImportReasonMissing');
    case 'duplicate_email':
      return t('clientImportReasonDuplicate');
    default:
      return t('clientImportReasonError');
  }
}
