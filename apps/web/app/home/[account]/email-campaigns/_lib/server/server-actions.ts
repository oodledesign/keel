'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { hasCampaignsGrowthFeatures } from '~/lib/billing/campaign-pricing';
import { canUseAddon } from '~/lib/billing/entitlements';
import { getCampaignUsage } from '~/lib/campaign-credits/ledger';
import { createAudienceListsService } from '~/lib/campaigns/audience-lists.service';
import { createCampaignAutomationsService } from '~/lib/campaigns/campaign-automations.service';
import { createCampaignContactsService } from '~/lib/campaigns/campaign-contacts.service';
import { isCampaignQuotaError } from '~/lib/campaigns/campaign-quota-error';
import { createCampaignsService } from '~/lib/campaigns/campaigns.service';

import {
  ArchiveContactCategorySchema,
  AssignContactCategoriesSchema,
  AudienceListMembersSchema,
  BulkAddContactsToListSchema,
  CancelScheduleCampaignSchema,
  CreateCampaignSchema,
  CreateListFromCategorySchema,
  DeleteAudienceListSchema,
  DeleteAutomationSchema,
  SaveAudienceListSchema,
  SaveAutomationSchema,
  SaveCampaignContactSchema,
  SaveContactCategorySchema,
  ScheduleCampaignSchema,
  SendCampaignSchema,
  SendCampaignTestSchema,
  UpdateCampaignSchema,
} from '../schemas/campaigns.schema';

function campaignsPath(accountSlug: string) {
  return pathsConfig.app.accountEmailCampaigns.replace(
    '[account]',
    accountSlug,
  );
}

function audiencesPath(accountSlug: string) {
  return pathsConfig.app.accountEmailCampaignAudiences.replace(
    '[account]',
    accountSlug,
  );
}

function contactsPath(accountSlug: string) {
  return pathsConfig.app.accountEmailCampaignContacts.replace(
    '[account]',
    accountSlug,
  );
}

function revalidateAudiencePaths(accountSlug: string) {
  revalidatePath(campaignsPath(accountSlug));
  revalidatePath(audiencesPath(accountSlug));
  revalidatePath(contactsPath(accountSlug));
}

function campaignPath(accountSlug: string, campaignId: string) {
  return pathsConfig.app.accountEmailCampaignDetail
    .replace('[account]', accountSlug)
    .replace('[campaignId]', campaignId);
}

function campaignContentPath(accountSlug: string, campaignId: string) {
  return pathsConfig.app.accountEmailCampaignContent
    .replace('[account]', accountSlug)
    .replace('[campaignId]', campaignId);
}

function campaignSendPath(accountSlug: string, campaignId: string) {
  return pathsConfig.app.accountEmailCampaignSend
    .replace('[account]', accountSlug)
    .replace('[campaignId]', campaignId);
}

function revalidateCampaignPaths(accountSlug: string, campaignId: string) {
  revalidatePath(campaignPath(accountSlug, campaignId));
  revalidatePath(campaignContentPath(accountSlug, campaignId));
  revalidatePath(campaignSendPath(accountSlug, campaignId));
  revalidatePath(campaignsPath(accountSlug));
}

async function requireCampaignsAddon(userId: string, accountId: string) {
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
  return client;
}

export const createCampaignAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createCampaignsService(client);
    const campaign = await service.create({
      accountId: data.accountId,
      userId: user.id,
      name: data.name,
      subject: data.subject,
      previewText: data.previewText,
      bodyDocument: data.bodyDocument,
    });

    logger.info(
      { name: 'create-campaign', userId: user.id, campaignId: campaign.id },
      'Created email campaign',
    );
    revalidatePath(campaignsPath(data.accountSlug));
    return { success: true as const, campaignId: campaign.id };
  },
  { auth: true, schema: CreateCampaignSchema },
);

export const updateCampaignAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createCampaignsService(client);
    const campaign = await service.update({
      accountId: data.accountId,
      campaignId: data.campaignId,
      name: data.name,
      subject: data.subject,
      previewText: data.previewText,
      bodyDocument: data.bodyDocument,
      fromName: data.fromName,
      fromEmail: data.fromEmail,
      replyTo: data.replyTo,
      audienceType: data.audienceType,
      audienceConfig: data.audienceConfig,
      scheduledAt: data.scheduledAt,
      scheduledTimezone: data.scheduledTimezone,
      subjectB: data.subjectB,
      abEnabled: data.abEnabled,
      abSplitPercent: data.abSplitPercent,
    });
    revalidateCampaignPaths(data.accountSlug, campaign.id);
    return { success: true as const };
  },
  { auth: true, schema: UpdateCampaignSchema },
);

export const sendCampaignAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const { data: account } = await client
      .from('accounts')
      .select('name')
      .eq('id', data.accountId)
      .maybeSingle();

    const service = createCampaignsService(client);
    try {
      const result = await service.startSend({
        accountId: data.accountId,
        campaignId: data.campaignId,
        workspaceName:
          (account as { name?: string } | null)?.name?.trim() || 'Workspace',
      });

      logger.info(
        {
          name: 'send-campaign',
          userId: user.id,
          campaignId: data.campaignId,
          remaining: result.remaining,
        },
        'Started campaign send',
      );
      revalidateCampaignPaths(data.accountSlug, data.campaignId);
      return {
        success: true as const,
        remaining: result.remaining,
        status: result.campaign.status,
      };
    } catch (error) {
      if (isCampaignQuotaError(error)) {
        return {
          success: false as const,
          code: error.kind === 'sends' ? 'INSUFFICIENT_SENDS' : 'CONTACT_CAP',
          message: error.message,
          needed: error.needed,
          have: error.have,
        };
      }
      throw error;
    }
  },
  { auth: true, schema: SendCampaignSchema },
);

export const sendCampaignTestAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createCampaignsService(client);

    // Resolve display names for team members when available.
    const displayNames: Record<string, string | null> = {};
    try {
      const { data: members } = await client.rpc('get_account_members', {
        account_slug: data.accountSlug,
      });
      for (const member of (members ?? []) as Array<{
        email?: string | null;
        name?: string | null;
      }>) {
        const email = member.email?.trim().toLowerCase();
        if (email) {
          displayNames[email] = member.name?.trim() || null;
        }
      }
    } catch {
      // Merge still works with email-only sample data.
    }

    const result = await service.sendTest({
      accountId: data.accountId,
      campaignId: data.campaignId,
      emails: data.emails,
      displayNames,
    });

    logger.info(
      {
        name: 'send-campaign-test',
        userId: user.id,
        campaignId: data.campaignId,
        sent: result.sent,
        failed: result.failed,
      },
      'Sent campaign test email(s)',
    );

    return {
      success: true as const,
      sent: result.sent,
      failed: result.failed,
      subject: result.subject,
    };
  },
  { auth: true, schema: SendCampaignTestSchema },
);

export const scheduleCampaignAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createCampaignsService(client);
    await service.schedule({
      accountId: data.accountId,
      campaignId: data.campaignId,
      scheduledAt: data.scheduledAt,
    });
    revalidateCampaignPaths(data.accountSlug, data.campaignId);
    return { success: true as const };
  },
  { auth: true, schema: ScheduleCampaignSchema },
);

export const cancelScheduleCampaignAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createCampaignsService(client);
    await service.cancelSchedule(data.accountId, data.campaignId);
    revalidateCampaignPaths(data.accountSlug, data.campaignId);
    return { success: true as const };
  },
  { auth: true, schema: CancelScheduleCampaignSchema },
);

async function requireGrowthCampaigns(accountId: string) {
  const usage = await getCampaignUsage(accountId);
  if (!hasCampaignsGrowthFeatures(usage.pool.plan_tier)) {
    throw new Error(
      'Saved lists and A/B tests are on Growth and Pro. Upgrade Campaigns in Billing.',
    );
  }
}

export const saveAudienceListAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    await requireGrowthCampaigns(data.accountId);
    const service = createAudienceListsService(client);
    const list = data.listId
      ? await service.update({
          accountId: data.accountId,
          listId: data.listId,
          name: data.name,
          filters: data.filters,
        })
      : await service.create({
          accountId: data.accountId,
          userId: user.id,
          name: data.name,
          filters: data.filters,
          contactIds: data.contactIds,
        });
    if (data.listId && data.filters.source === 'manual' && data.contactIds) {
      await service.replaceMembers({
        accountId: data.accountId,
        listId: list.id,
        contactIds: data.contactIds,
      });
    }
    revalidateAudiencePaths(data.accountSlug);
    return { success: true as const, listId: list.id };
  },
  { auth: true, schema: SaveAudienceListSchema },
);

export const deleteAudienceListAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    await requireGrowthCampaigns(data.accountId);
    await createAudienceListsService(client).delete(
      data.accountId,
      data.listId,
    );
    revalidateAudiencePaths(data.accountSlug);
    return { success: true as const };
  },
  { auth: true, schema: DeleteAudienceListSchema },
);

export const addAudienceListMembersAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    await requireGrowthCampaigns(data.accountId);
    const added = await createAudienceListsService(client).addMembers({
      accountId: data.accountId,
      listId: data.listId,
      contactIds: data.contactIds,
    });
    revalidateAudiencePaths(data.accountSlug);
    return { success: true as const, added };
  },
  { auth: true, schema: AudienceListMembersSchema },
);

export const removeAudienceListMembersAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    await requireGrowthCampaigns(data.accountId);
    await createAudienceListsService(client).removeMembers({
      accountId: data.accountId,
      listId: data.listId,
      contactIds: data.contactIds,
    });
    revalidateAudiencePaths(data.accountSlug);
    return { success: true as const };
  },
  { auth: true, schema: AudienceListMembersSchema },
);

export const createListFromCategoryAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    await requireGrowthCampaigns(data.accountId);
    const contacts = createCampaignContactsService(client);
    const lists = createAudienceListsService(client);
    const categories = await contacts.listCategories(data.accountId);
    const category = categories.find((row) => row.id === data.categoryId);
    if (!category || category.archivedAt) {
      throw new Error('Category not found');
    }

    const list =
      data.mode === 'logic'
        ? await lists.create({
            accountId: data.accountId,
            userId: user.id,
            name: data.name,
            filters: {
              source: 'contacts',
              matchMode: 'all',
              rules: [{ field: 'category', op: 'eq', value: category.id }],
            },
          })
        : await lists.create({
            accountId: data.accountId,
            userId: user.id,
            name: data.name,
            filters: { source: 'manual', matchMode: 'all', rules: [] },
            contactIds: await contacts.listContactIdsInCategory(
              data.accountId,
              data.categoryId,
            ),
          });

    revalidateAudiencePaths(data.accountSlug);
    return { success: true as const, listId: list.id };
  },
  { auth: true, schema: CreateListFromCategorySchema },
);

export const saveCampaignContactAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    if ((data.categoryIds ?? []).length > 0) {
      await requireGrowthCampaigns(data.accountId);
    }
    const contact = await createCampaignContactsService(client).saveContact({
      accountId: data.accountId,
      userId: user.id,
      contactId: data.contactId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      fullName: data.fullName,
      phone: data.phone,
      companyName: data.companyName,
      industry: data.industry,
      categoryIds: data.categoryIds,
    });
    revalidateAudiencePaths(data.accountSlug);
    return { success: true as const, contactId: contact.id };
  },
  { auth: true, schema: SaveCampaignContactSchema },
);

export const saveContactCategoryAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    await requireGrowthCampaigns(data.accountId);
    const category = await createCampaignContactsService(client).saveCategory({
      accountId: data.accountId,
      userId: user.id,
      categoryId: data.categoryId,
      name: data.name,
    });
    revalidateAudiencePaths(data.accountSlug);
    return { success: true as const, categoryId: category.id };
  },
  { auth: true, schema: SaveContactCategorySchema },
);

export const archiveContactCategoryAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    await requireGrowthCampaigns(data.accountId);
    await createCampaignContactsService(client).archiveCategory(
      data.accountId,
      data.categoryId,
    );
    revalidateAudiencePaths(data.accountSlug);
    return { success: true as const };
  },
  { auth: true, schema: ArchiveContactCategorySchema },
);

export const assignContactCategoriesAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    await requireGrowthCampaigns(data.accountId);
    await createCampaignContactsService(client).addCategoriesToContacts({
      accountId: data.accountId,
      contactIds: data.contactIds,
      categoryIds: data.categoryIds,
    });
    revalidateAudiencePaths(data.accountSlug);
    return { success: true as const };
  },
  { auth: true, schema: AssignContactCategoriesSchema },
);

export const bulkAddContactsToListAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    await requireGrowthCampaigns(data.accountId);
    const lists = createAudienceListsService(client);
    const listId = data.listId;

    if (!listId) {
      if (!data.newListName?.trim()) {
        throw new Error('Choose an existing list or name a new one');
      }
      const created = await lists.create({
        accountId: data.accountId,
        userId: user.id,
        name: data.newListName,
        filters: { source: 'manual', matchMode: 'all', rules: [] },
        contactIds: data.contactIds,
      });
      revalidateAudiencePaths(data.accountSlug);
      return { success: true as const, listId: created.id, created: true };
    }

    await lists.addMembers({
      accountId: data.accountId,
      listId,
      contactIds: data.contactIds,
    });
    revalidateAudiencePaths(data.accountSlug);
    return { success: true as const, listId, created: false };
  },
  { auth: true, schema: BulkAddContactsToListSchema },
);

export const saveAutomationAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createCampaignAutomationsService(client);
    const automation = data.automationId
      ? await service.update({
          accountId: data.accountId,
          automationId: data.automationId,
          name: data.name,
          campaignId: data.campaignId,
          status: data.status,
        })
      : await service.create({
          accountId: data.accountId,
          userId: user.id,
          name: data.name,
          campaignId: data.campaignId,
        });
    revalidatePath(
      pathsConfig.app.accountEmailCampaignAutomations.replace(
        '[account]',
        data.accountSlug,
      ),
    );
    return { success: true as const, automationId: automation.id };
  },
  { auth: true, schema: SaveAutomationSchema },
);

export const deleteAutomationAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    await createCampaignAutomationsService(client).delete(
      data.accountId,
      data.automationId,
    );
    revalidatePath(
      pathsConfig.app.accountEmailCampaignAutomations.replace(
        '[account]',
        data.accountSlug,
      ),
    );
    return { success: true as const };
  },
  { auth: true, schema: DeleteAutomationSchema },
);
