'use client';

import { useCallback, useMemo } from 'react';

import { useSearchParams } from 'next/navigation';

import { CsvImportWizard } from '~/components/bulk-import/csv-import-wizard';
import pathsConfig from '~/config/paths.config';
import {
  CAMPAIGN_CONTACT_CSV_FIELD_OPTIONS,
  buildCampaignContactImportTemplateCsv,
} from '~/lib/campaigns/campaign-contact-csv';
import type { CampaignAudienceList } from '~/lib/campaigns/campaign.types';
import type { CsvFieldMapping } from '~/lib/csv/rows-to-records';

import {
  commitCampaignContactImportAction,
  previewCampaignContactImportAction,
  suggestCampaignContactImportMappingAction,
} from '../_lib/server/contact-import-actions';

export function CampaignContactImportClient({
  accountId,
  accountSlug,
  lists,
}: {
  accountId: string;
  accountSlug: string;
  lists: CampaignAudienceList[];
}) {
  const searchParams = useSearchParams();
  const existingListId = searchParams.get('listId') ?? '';
  const listName = useMemo(
    () => lists.find((list) => list.id === existingListId)?.name,
    [existingListId, lists],
  );

  const backHref = pathsConfig.app.accountEmailCampaignContacts.replace(
    '[account]',
    accountSlug,
  );

  const onSuggestMapping = useCallback(
    async (input: { headers: string[]; sampleRows: string[][] }) => {
      return suggestCampaignContactImportMappingAction({
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
      return previewCampaignContactImportAction({
        accountId,
        headers: input.headers,
        rows: input.rows,
        mapping: input.mapping,
      });
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
      const result = await commitCampaignContactImportAction({
        accountId,
        accountSlug,
        listId: existingListId || undefined,
        headers: input.headers,
        rows: input.rows,
        mapping: input.mapping,
      });
      return {
        summary: result.summary,
        failedCount: result.failedCount,
      };
    },
    [accountId, accountSlug, existingListId],
  );

  return (
    <CsvImportWizard
      title={
        listName
          ? `Upload contacts into “${listName}”`
          : 'Upload contacts to a list'
      }
      description="Map columns, preview valid and rejected rows, then confirm. Matching uses email (case-insensitive) in this workspace."
      backHref={backHref}
      fieldOptions={CAMPAIGN_CONTACT_CSV_FIELD_OPTIONS}
      template={{
        filename: 'ozer-campaign-contacts-template.csv',
        csv: buildCampaignContactImportTemplateCsv(),
      }}
      onSuggestMapping={onSuggestMapping}
      onPreview={onPreview}
      onCommit={onCommit}
    />
  );
}
