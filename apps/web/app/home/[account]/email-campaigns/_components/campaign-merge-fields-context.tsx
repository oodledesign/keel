'use client';

import { createContext, useContext, useMemo } from 'react';

import {
  CAMPAIGN_MERGE_FIELDS,
  type CampaignMergeFieldOption,
  customMergeFieldOptions,
} from '~/lib/campaigns/merge-fields';
import type { ContactCustomFieldDefinition } from '~/lib/contacts/custom-fields';

const CustomFieldsContext = createContext<ContactCustomFieldDefinition[]>([]);

export function CampaignMergeFieldsProvider({
  customFields,
  children,
}: {
  customFields: ContactCustomFieldDefinition[];
  children: React.ReactNode;
}) {
  return (
    <CustomFieldsContext.Provider value={customFields}>
      {children}
    </CustomFieldsContext.Provider>
  );
}

export function useCampaignCustomFields() {
  return useContext(CustomFieldsContext);
}

/** Built-in merge tags followed by the workspace's custom contact fields. */
export function useCampaignMergeFields(): readonly CampaignMergeFieldOption[] {
  const customFields = useContext(CustomFieldsContext);
  return useMemo(
    () => [...CAMPAIGN_MERGE_FIELDS, ...customMergeFieldOptions(customFields)],
    [customFields],
  );
}
