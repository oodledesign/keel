'use client';

import { useCallback, useRef } from 'react';

import { CsvImportWizard } from '~/components/bulk-import/csv-import-wizard';
import pathsConfig from '~/config/paths.config';
import { CLIENT_CSV_FIELD_OPTIONS } from '~/lib/ai/client-csv-fields';
import type { CsvFieldMapping } from '~/lib/csv/rows-to-records';

import {
  commitClientImportAction,
  previewClientImportAction,
  suggestClientImportMappingAction,
} from '../_lib/server/client-import-actions';

export function ClientImportPageClient({
  accountId,
  accountSlug,
}: {
  accountId: string;
  accountSlug: string;
}) {
  const previewCache = useRef<{
    drafts: Awaited<ReturnType<typeof previewClientImportAction>>['drafts'];
    duplicates: Awaited<
      ReturnType<typeof previewClientImportAction>
    >['duplicates'];
  } | null>(null);

  const backHref = pathsConfig.app.accountClients.replace(
    '[account]',
    accountSlug,
  );

  const onSuggestMapping = useCallback(
    async (input: { headers: string[]; sampleRows: string[][] }) => {
      return suggestClientImportMappingAction({
        accountId,
        headers: input.headers,
        sampleRows: input.sampleRows,
      });
    },
    [accountId],
  );

  const onPreview = useCallback(
    async (input: {
      headers: string[];
      rows: string[][];
      mapping: CsvFieldMapping;
    }) => {
      const result = await previewClientImportAction({
        accountId,
        headers: input.headers,
        rows: input.rows,
        mapping: input.mapping,
      });
      previewCache.current = {
        drafts: result.drafts,
        duplicates: result.duplicates,
      };

      return {
        previewRows: result.drafts.map((draft) => ({
          id: String(draft.rowIndex),
          label:
            draft.clientType === 'business'
              ? draft.companyName || `Row ${draft.rowIndex + 1}`
              : [draft.firstName, draft.lastName].filter(Boolean).join(' ') ||
                `Row ${draft.rowIndex + 1}`,
          detail: [draft.email, draft.phone].filter(Boolean).join(' · '),
          errors: draft.errors,
        })),
        duplicateRows: result.duplicates.map((dup) => {
          const draft = result.drafts.find((d) => d.rowIndex === dup.rowIndex);
          return {
            id: String(dup.rowIndex),
            incomingLabel:
              draft?.companyName ||
              [draft?.firstName, draft?.lastName].filter(Boolean).join(' ') ||
              draft?.email ||
              `Row ${dup.rowIndex + 1}`,
            existingLabel:
              dup.existing.displayName || dup.existing.email || dup.existing.id,
            matchReason: dup.matchReason,
          };
        }),
        validCount: result.validCount,
        errorCount: result.errorCount,
      };
    },
    [accountId],
  );

  const onCommit = useCallback(
    async (input: {
      headers: string[];
      rows: string[][];
      mapping: CsvFieldMapping;
      duplicateActions: Record<string, 'keep' | 'overwrite' | 'create_new'>;
    }) => {
      const result = await commitClientImportAction({
        accountId,
        accountSlug,
        headers: input.headers,
        rows: input.rows,
        mapping: input.mapping,
        duplicateActions: input.duplicateActions,
      });

      const parts = [
        result.imported ? `${result.imported} imported` : null,
        result.updated ? `${result.updated} updated` : null,
        result.skipped ? `${result.skipped} skipped` : null,
        result.failed.length ? `${result.failed.length} failed` : null,
      ].filter(Boolean);

      return {
        summary: parts.length
          ? `Import complete: ${parts.join(', ')}.`
          : 'Nothing was imported.',
        failedCount: result.failed.length,
      };
    },
    [accountId, accountSlug],
  );

  return (
    <CsvImportWizard
      title="Import clients"
      description="Upload a CSV, map columns, resolve duplicates, then import."
      backHref={backHref}
      fieldOptions={CLIENT_CSV_FIELD_OPTIONS}
      enableDuplicateReview
      onSuggestMapping={onSuggestMapping}
      onPreview={onPreview}
      onCommit={onCommit}
    />
  );
}
