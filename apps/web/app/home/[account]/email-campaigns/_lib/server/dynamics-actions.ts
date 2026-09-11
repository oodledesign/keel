'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { canUseAddon } from '~/lib/billing/entitlements';
import { createDynamicsConnectionService } from '~/lib/dynamics/connection.service';
import { createDataverseClient } from '~/lib/dynamics/dataverse-client';
import {
  processDueDynamicsSyncJobs,
  retryFailedDynamicsSyncJobs,
} from '~/lib/dynamics/sync.service';

import {
  DynamicsAccountSchema,
  SaveDynamicsConnectionSchema,
} from '../schemas/dynamics.schema';

function dynamicsPath(accountSlug: string) {
  return pathsConfig.app.accountEmailCampaignDynamics.replace(
    '[account]',
    accountSlug,
  );
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

export const saveDynamicsConnectionAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createDynamicsConnectionService(client);
    const connection = await service.save({
      accountId: data.accountId,
      userId: user.id,
      syncEnabled: data.syncEnabled,
      tenantId: data.tenantId,
      environmentUrl: data.environmentUrl,
      applicationId: data.applicationId,
      clientSecret: data.clientSecret,
      entity: data.entity,
      fieldMapping: data.fieldMapping,
    });
    revalidatePath(dynamicsPath(data.accountSlug));
    return connection;
  },
  { auth: true, schema: SaveDynamicsConnectionSchema },
);

export const disconnectDynamicsConnectionAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const connection = await createDynamicsConnectionService(client).disconnect(
      data.accountId,
    );
    revalidatePath(dynamicsPath(data.accountSlug));
    return connection;
  },
  { auth: true, schema: DynamicsAccountSchema },
);

export const testDynamicsConnectionAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const service = createDynamicsConnectionService(client);
    const secrets = await service.loadSecrets(data.accountId);

    if (!secrets) {
      throw new Error('Save the Azure app credentials before testing.');
    }

    try {
      const who = await createDataverseClient({
        tenantId: secrets.tenantId,
        environmentUrl: secrets.environmentUrl,
        applicationId: secrets.applicationId,
        clientSecret: secrets.clientSecret,
      }).whoAmI();
      await service.recordTest(data.accountId, { ok: true });
      revalidatePath(dynamicsPath(data.accountSlug));
      return { ok: true as const, organizationId: who.OrganizationId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        { name: 'dynamics.test', accountId: data.accountId, error: message },
        'Dynamics connection test failed',
      );
      await service.recordTest(data.accountId, { ok: false, error: message });
      revalidatePath(dynamicsPath(data.accountSlug));
      throw new Error(message);
    }
  },
  { auth: true, schema: DynamicsAccountSchema },
);

export const retryDynamicsSyncJobsAction = enhanceAction(
  async function (data, user) {
    const client = await requireCampaignsAddon(user.id, data.accountId);
    const reset = await retryFailedDynamicsSyncJobs(client, data.accountId);
    const result = await processDueDynamicsSyncJobs(client, {
      accountId: data.accountId,
    });
    revalidatePath(dynamicsPath(data.accountSlug));
    return { reset, ...result };
  },
  { auth: true, schema: DynamicsAccountSchema },
);
