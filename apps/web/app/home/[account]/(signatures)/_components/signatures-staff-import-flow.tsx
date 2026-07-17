'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import Papa from 'papaparse';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import type { StaffSource } from '~/lib/signatures/staff-source';
import {
  isSyncedStaffSource,
  staffSourceLabel,
} from '~/lib/signatures/staff-source';

import type { StaffImportMappingValue } from '../_lib/schema/signatures-module.schema';
import { importSignatureStaffFromCsv } from '../_lib/server/signatures-module-actions';
import {
  type ParsedStaffImportRow,
  applyStaffImportMapping,
  buildStaffImportTemplateCsv,
  guessStaffImportMapping,
  isStaffImportMappingComplete,
  mappingTargetsDuplicate,
} from '../_lib/signatures-staff-import-mapping';

const MAX_ROWS = 1000;
const MAPPING_OPTIONS: Array<{
  value: StaffImportMappingValue;
  label: string;
}> = [
  { value: '__skip__', label: 'Do not import' },
  { value: 'full_name', label: 'Full name' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'email', label: 'Email' },
  { value: 'job_title', label: 'Job title' },
  { value: 'department', label: 'Department' },
  { value: 'phone', label: 'Phone' },
  { value: 'phone_direct', label: 'Direct phone' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'phone_mobile', label: 'Mobile phone' },
];

type ExistingStaff = {
  id: string;
  email: string;
  source: StaffSource;
  full_name: string | null;
};

type DuplicateAction = 'update' | 'skip';

type PreviewRow = ParsedStaffImportRow & {
  duplicateAction: DuplicateAction;
  existingStaffId: string | null;
  existingSource: StaffSource | null;
};

function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (
      !key ||
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype'
    ) {
      continue;
    }
    out[key] = value == null ? '' : String(value);
  }
  return out;
}

function downloadTemplate() {
  const blob = new Blob([buildStaffImportTemplateCsv()], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'ozer-signatures-staff-template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SignaturesStaffImportFlow({
  accountId,
  existingStaff,
}: {
  accountId: string;
  existingStaff: ExistingStaff[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>(
    'upload',
  );
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<
    Record<string, StaffImportMappingValue>
  >({});
  const [defaultDuplicateAction, setDefaultDuplicateAction] =
    useState<DuplicateAction>('skip');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [pending, setPending] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const existingByEmail = useMemo(() => {
    const map = new Map<string, ExistingStaff>();
    for (const row of existingStaff) {
      map.set(row.email.trim().toLowerCase(), row);
    }
    return map;
  }, [existingStaff]);

  const reset = () => {
    setStep('upload');
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setPreviewRows([]);
    setSummary(null);
    setDefaultDuplicateAction('skip');
  };

  const onFile = (file: File | null) => {
    if (!file) return;

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (result) => {
        const rows = (result.data ?? [])
          .map(normalizeRow)
          .filter((row) => Object.values(row).some((value) => value.trim()));

        if (rows.length === 0) {
          toast.error('That CSV did not contain any rows.');
          return;
        }
        if (rows.length > MAX_ROWS) {
          toast.error(`Import up to ${MAX_ROWS} rows at a time.`);
          return;
        }

        const nextHeaders = Object.keys(rows[0] ?? {});
        setHeaders(nextHeaders);
        setRawRows(rows);
        setMapping(guessStaffImportMapping(nextHeaders));
        setStep('map');
      },
      error: (error) => {
        toast.error(error.message || 'Could not read that CSV file.');
      },
    });
  };

  const buildPreview = () => {
    if (mappingTargetsDuplicate(mapping)) {
      toast.error('Each field can only be mapped once.');
      return;
    }
    if (!isStaffImportMappingComplete(mapping)) {
      toast.error('Map email and either full name or first and last name.');
      return;
    }

    const parsed = applyStaffImportMapping(rawRows, mapping);
    const nextPreview: PreviewRow[] = parsed.map((row) => {
      const existing = row.email ? existingByEmail.get(row.email) : undefined;
      return {
        ...row,
        duplicateAction: defaultDuplicateAction,
        existingStaffId: existing?.id ?? null,
        existingSource: existing?.source ?? null,
      };
    });
    setPreviewRows(nextPreview);
    setStep('preview');
  };

  const importRows = async () => {
    const validRows = previewRows.filter((row) => row.errors.length === 0);
    if (validRows.length === 0) {
      toast.error('No valid rows to import.');
      return;
    }

    setPending(true);
    try {
      const result = await importSignatureStaffFromCsv({
        accountId,
        rows: validRows.map((row) => {
          const existing = row.email
            ? existingByEmail.get(row.email)
            : undefined;
          const duplicate = Boolean(existing);
          const blockedDuplicate =
            duplicate && existing && isSyncedStaffSource(existing.source);

          let action: 'insert' | 'update' | 'skip' = 'insert';
          if (blockedDuplicate) {
            action = 'skip';
          } else if (duplicate) {
            action = row.duplicateAction;
          }

          return {
            rowNumber: row.rowNumber,
            email: row.email,
            full_name: row.full_name,
            job_title: row.job_title,
            department: row.department,
            phone_direct: row.phone_direct,
            phone_mobile: row.phone_mobile,
            action,
            existingStaffId: existing?.id ?? null,
          };
        }),
      });

      const message = `Imported ${result.imported}, updated ${result.updated}, skipped ${result.skipped}.`;
      setSummary(
        result.failures.length
          ? `${message} ${result.failures.length} row${result.failures.length === 1 ? '' : 's'} failed.`
          : message,
      );
      setStep('done');
      router.refresh();
      toast.success(message);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        data-test="signatures-import-csv-button"
      >
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Import from CSV
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import staff from CSV</DialogTitle>
            <DialogDescription>
              Upload a spreadsheet, map your columns, review validation, then
              import up to {MAX_ROWS} people. Photos can be added afterwards on
              each person&apos;s edit screen.
            </DialogDescription>
          </DialogHeader>

          {step === 'upload' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadTemplate}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download template
                </Button>
                <Label className="inline-flex">
                  <Button type="button" asChild variant="default">
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      Choose CSV
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(event) =>
                          onFile(event.target.files?.[0] ?? null)
                        }
                      />
                    </span>
                  </Button>
                </Label>
              </div>
            </div>
          ) : null}

          {step === 'map' ? (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                {rawRows.length} row{rawRows.length === 1 ? '' : 's'} detected.
              </p>
              <div className="space-y-3">
                {headers.map((header) => (
                  <div
                    key={header}
                    className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]"
                  >
                    <div className="text-sm font-medium">{header}</div>
                    <Select
                      value={mapping[header] ?? '__skip__'}
                      onValueChange={(value) =>
                        setMapping((current) => ({
                          ...current,
                          [header]: value as StaffImportMappingValue,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MAPPING_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('upload')}
                >
                  Back
                </Button>
                <Button type="button" onClick={buildPreview}>
                  Preview import
                </Button>
              </DialogFooter>
            </div>
          ) : null}

          {step === 'preview' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Label className="text-sm">When an email already exists:</Label>
                <Select
                  value={defaultDuplicateAction}
                  onValueChange={(value) => {
                    const action = value as DuplicateAction;
                    setDefaultDuplicateAction(action);
                    setPreviewRows((rows) =>
                      rows.map((row) =>
                        row.existingStaffId &&
                        !isSyncedStaffSource(row.existingSource ?? '')
                          ? { ...row, duplicateAction: action }
                          : row,
                      ),
                    );
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip duplicates</SelectItem>
                    <SelectItem value="update">Update existing rows</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row) => {
                      const blocked =
                        row.existingSource &&
                        isSyncedStaffSource(row.existingSource);
                      return (
                        <TableRow key={row.rowNumber}>
                          <TableCell>{row.rowNumber}</TableCell>
                          <TableCell>{row.full_name || '—'}</TableCell>
                          <TableCell>{row.email || '—'}</TableCell>
                          <TableCell>
                            {row.errors.length ? (
                              <span className="text-destructive text-xs">
                                {row.errors.join(' · ')}
                              </span>
                            ) : row.existingStaffId ? (
                              <Badge variant="outline">
                                Existing {staffSourceLabel(row.existingSource!)}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">New</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.errors.length || blocked ? (
                              <span className="text-muted-foreground text-xs">
                                {blocked ? 'Protected synced row' : 'Invalid'}
                              </span>
                            ) : row.existingStaffId ? (
                              <Select
                                value={row.duplicateAction}
                                onValueChange={(value) =>
                                  setPreviewRows((rows) =>
                                    rows.map((current) =>
                                      current.rowNumber === row.rowNumber
                                        ? {
                                            ...current,
                                            duplicateAction:
                                              value as DuplicateAction,
                                          }
                                        : current,
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger className="h-8 w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="skip">Skip</SelectItem>
                                  <SelectItem value="update">Update</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                Insert
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('map')}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => void importRows()}
                >
                  {pending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing…
                    </>
                  ) : (
                    'Confirm import'
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : null}

          {step === 'done' && summary ? (
            <div className="space-y-4">
              <p className="text-sm">{summary}</p>
              <DialogFooter>
                <Button type="button" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
