'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { hasCampaignsGrowthFeatures } from '~/lib/billing/campaign-pricing';
import { canUseAddon } from '~/lib/billing/entitlements';
import { getCampaignUsage } from '~/lib/campaign-credits/ledger';
import { createAudienceListsService } from '~/lib/campaigns/audience-lists.service';
import {
  CampaignContactCsvMappingSchema,
  heuristicCampaignContactMapping,
  parseCampaignContactCsvRows,
  summarizeCampaignContactCsvDrafts,
} from '~/lib/campaigns/campaign-contact-csv';
import { createCampaignContactsService } from '~/lib/campaigns/campaign-contacts.service';

async function requireGrowthImport(userId: string, accountId: string) {
  const client = getSupabaseServerClient();
  const allowed = await canUseAddon(
    client,
    userId,
    accountId,
    'addon_campaigns',
  );
  if (!allowed) {
    throw new Error(
      'Campaigns add-on required. Subscribe from Billing in this workspace.',
    );
  }
  const usage = await getCampaignUsage(accountId);
  if (!hasCampaignsGrowthFeatures(usage.pool.plan_tier)) {
    throw new Error(
      'CSV list import is on Growth and Pro. Upgrade Campaigns in Billing.',
    );
  }
  return client;
}

function revalidateImportPaths(accountSlug: string) {
  revalidatePath(
    pathsConfig.app.accountEmailCampaignContacts.replace(
      '[account]',
      accountSlug,
    ),
  );
  revalidatePath(
    pathsConfig.app.accountEmailCampaignAudiences.replace(
      '[account]',
      accountSlug,
    ),
  );
}

const suggestSchema = z.object({
  accountId: z.string().uuid(),
  headers: z.array(z.string()).min(1).max(100),
  sampleRows: z.array(z.array(z.string())).max(10),
});

const previewSchema = z.object({
  accountId: z.string().uuid(),
  headers: z.array(z.string()).min(1).max(100),
  rows: z.array(z.array(z.string())).max(5000),
  mapping: CampaignContactCsvMappingSchema,
});

const commitSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  listId: z.string().uuid().optional(),
  newListName: z.string().trim().min(1).max(120).optional(),
  headers: z.array(z.string()).min(1).max(100),
  rows: z.array(z.array(z.string())).max(5000),
  mapping: CampaignContactCsvMappingSchema,
});

export const suggestCampaignContactImportMappingAction = enhanceAction(
  async function (data) {
    return heuristicCampaignContactMapping(data.headers);
  },
  { auth: true, schema: suggestSchema },
);

export const previewCampaignContactImportAction = enhanceAction(
  async function (data, user) {
    await requireGrowthImport(user.id, data.accountId);
    const drafts = parseCampaignContactCsvRows(
      data.headers,
      data.rows,
      data.mapping,
    );
    const summary = summarizeCampaignContactCsvDrafts(drafts);
    const contacts = createCampaignContactsService(getSupabaseServerClient());
    const existing = await contacts.findByEmails(
      data.accountId,
      summary.valid.slice(0, 200).map((draft) => draft.email),
    );

    const previewRows = drafts.slice(0, 200).map((draft) => {
      const match =
        draft.errors.length === 0 ? existing.get(draft.email) : undefined;
      return {
        id: String(draft.rowIndex),
        label: draft.fullName || draft.email || `Row ${draft.rowIndex + 1}`,
        detail: [draft.email, draft.companyName, draft.phone]
          .filter(Boolean)
          .join(' · '),
        errors: draft.errors,
        warnings: match
          ? [`Matches existing contact ${match.fullName || match.email}`]
          : [],
      };
    });

    return {
      previewRows,
      validCount: summary.validCount,
      errorCount: summary.errorCount,
    };
  },
  { auth: true, schema: previewSchema },
);

export const commitCampaignContactImportAction = enhanceAction(
  async function (data, user) {
    const client = await requireGrowthImport(user.id, data.accountId);
    const drafts = parseCampaignContactCsvRows(
      data.headers,
      data.rows,
      data.mapping,
    );
    const summary = summarizeCampaignContactCsvDrafts(drafts);
    const contacts = createCampaignContactsService(client);
    const lists = createAudienceListsService(client);

    const imported = await contacts.importByEmail(
      data.accountId,
      user.id,
      summary.valid,
    );
    const created = imported.created;
    const matched = imported.matched;
    const contactIds = imported.contactIds;
    const failed = imported.failed.map((row) => ({
      row: row.email,
      error: row.error,
    }));

    let listId = data.listId ?? null;
    if (!listId) {
      const name =
        data.newListName?.trim() ||
        `Imported ${new Date().toISOString().slice(0, 10)}`;
      const list = await lists.create({
        accountId: data.accountId,
        userId: user.id,
        name,
        filters: { source: 'manual', matchMode: 'all', rules: [] },
        contactIds,
      });
      listId = list.id;
    } else if (contactIds.length > 0) {
      await lists.addMembers({
        accountId: data.accountId,
        listId,
        contactIds,
      });
    }

    revalidateImportPaths(data.accountSlug);

    const rejected = summary.errorCount + failed.length;
    const parts = [
      created ? `${created} created` : null,
      matched ? `${matched} matched` : null,
      rejected ? `${rejected} rejected` : null,
    ].filter(Boolean);

    return {
      listId,
      created,
      matched,
      rejected,
      failed,
      summary: parts.length
        ? `List ready: ${parts.join(', ')}.`
        : 'No valid rows to import.',
      failedCount: rejected,
    };
  },
  { auth: true, schema: commitSchema },
);
