'use client';

import { useCallback, useRef } from 'react';

import { CsvImportWizard } from '~/components/bulk-import/csv-import-wizard';
import pathsConfig from '~/config/paths.config';
import { TASK_CSV_FIELD_OPTIONS } from '~/lib/ai/task-csv-fields';
import type { CsvFieldMapping } from '~/lib/csv/rows-to-records';

import {
  type TaskImportDraft,
  commitTaskImportAction,
  previewTaskImportAction,
  suggestTaskImportMappingAction,
} from '../_lib/server/task-import-actions';

export function TaskImportPageClient({
  accountId,
  accountSlug,
}: {
  accountId: string;
  accountSlug: string;
}) {
  const previewCache = useRef<TaskImportDraft[] | null>(null);

  const backHref = pathsConfig.app.accountTasks.replace(
    '[account]',
    accountSlug,
  );

  const onSuggestMapping = useCallback(
    async (input: { headers: string[]; sampleRows: string[][] }) => {
      return suggestTaskImportMappingAction({
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
      const result = await previewTaskImportAction({
        accountId,
        headers: input.headers,
        rows: input.rows,
        mapping: input.mapping,
      });
      previewCache.current = result.drafts;

      return {
        previewRows: result.drafts.map((draft) => ({
          id: String(draft.rowIndex),
          label: draft.title || `Row ${draft.rowIndex + 1}`,
          detail: [
            draft.dueDate,
            draft.clientName,
            draft.projectName,
            draft.priority,
          ]
            .filter(Boolean)
            .join(' · '),
          errors: draft.errors,
          warnings: draft.warnings,
        })),
        validCount: result.validCount,
        errorCount: result.errorCount,
      };
    },
    [accountId],
  );

  const onCommit = useCallback(async () => {
    const drafts = previewCache.current;
    if (!drafts) throw new Error('Preview required before import');

    const tasks = drafts
      .filter((draft) => draft.errors.length === 0)
      .map((draft) => ({
        title: draft.title,
        notes: draft.notes,
        dueDate: draft.dueDate,
        priority: draft.priority,
        status: draft.status,
        clientId: draft.clientId,
        projectId: draft.projectId,
      }));

    const result = await commitTaskImportAction({
      accountId,
      accountSlug,
      tasks,
    });

    return {
      summary: result.failed.length
        ? `Imported ${result.imported} tasks (${result.failed.length} failed).`
        : `Imported ${result.imported} tasks.`,
      failedCount: result.failed.length,
    };
  }, [accountId, accountSlug]);

  return (
    <CsvImportWizard
      title="Import tasks"
      description="Upload a CSV, map columns, then create tasks. Client and project names are matched when possible."
      backHref={backHref}
      fieldOptions={TASK_CSV_FIELD_OPTIONS}
      onSuggestMapping={onSuggestMapping}
      onPreview={onPreview}
      onCommit={onCommit}
    />
  );
}
