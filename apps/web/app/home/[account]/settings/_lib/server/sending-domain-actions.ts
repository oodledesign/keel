'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { createSesIdentityAdmin, createSesMailer } from '@kit/ses';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import {
  SendingDomainError,
  createSendingDomainService,
  getPlatformSesFrom,
  isSendingDomainVerified,
  resolveWorkspaceMailFrom,
} from '~/lib/sending-domains';

import {
  AddSendingDomainSchema,
  SendingDomainAccountSchema,
  UpdateSendingLocalPartSchema,
} from '../schema/sending-domain.schema';
import { assertCanEditBrandSettings } from './brand-settings-access';

function workPath(template: string, accountSlug: string) {
  return template.replace('[account]', accountSlug);
}

function revalidateSendingDomain(accountSlug: string) {
  revalidatePath(workPath(pathsConfig.app.accountSettings, accountSlug));
  revalidatePath(
    workPath(pathsConfig.app.accountSendingDomainSettings, accountSlug),
  );
}

async function getWritableService(accountId: string, userId: string) {
  const { accountSlug } = await assertCanEditBrandSettings(accountId, userId);
  const admin = getSupabaseServerAdminClient();
  const service = createSendingDomainService(admin, createSesIdentityAdmin());
  return { accountSlug, service };
}

function toActionError(error: unknown): never {
  if (error instanceof SendingDomainError) {
    throw error;
  }

  if (error instanceof Error) {
    throw new SendingDomainError(error.message);
  }

  throw new SendingDomainError('Something went wrong. Please try again.');
}

export const addSendingDomainAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const ctx = { name: 'add-sending-domain', userId: user.id };

    logger.info(ctx, 'Adding sending domain');

    try {
      const { accountSlug, service } = await getWritableService(
        data.accountId,
        user.id,
      );
      const result = await service.createDomain({
        accountId: data.accountId,
        domain: data.domain,
        userId: user.id,
        localPart: data.localPart,
      });

      logger.info(
        { ...ctx, domain: result.domain },
        'Sending domain created',
      );
      revalidateSendingDomain(accountSlug);
      return result;
    } catch (error) {
      toActionError(error);
    }
  },
  { auth: true, schema: AddSendingDomainSchema },
);

export const refreshSendingDomainAction = enhanceAction(
  async function (data, user) {
    try {
      const { accountSlug, service } = await getWritableService(
        data.accountId,
        user.id,
      );
      const result = await service.refreshStatus(data.accountId);
      revalidateSendingDomain(accountSlug);
      return result;
    } catch (error) {
      toActionError(error);
    }
  },
  { auth: true, schema: SendingDomainAccountSchema },
);

export const updateSendingLocalPartAction = enhanceAction(
  async function (data, user) {
    try {
      const { accountSlug, service } = await getWritableService(
        data.accountId,
        user.id,
      );
      const result = await service.updateLocalPart(
        data.accountId,
        data.localPart,
      );
      revalidateSendingDomain(accountSlug);
      return result;
    } catch (error) {
      toActionError(error);
    }
  },
  { auth: true, schema: UpdateSendingLocalPartSchema },
);

export const removeSendingDomainAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const ctx = { name: 'remove-sending-domain', userId: user.id };

    logger.info(ctx, 'Removing sending domain');

    try {
      const { accountSlug, service } = await getWritableService(
        data.accountId,
        user.id,
      );
      await service.removeDomain(data.accountId);
      logger.info(ctx, 'Sending domain removed');
      revalidateSendingDomain(accountSlug);
      return { ok: true as const };
    } catch (error) {
      toActionError(error);
    }
  },
  { auth: true, schema: SendingDomainAccountSchema },
);

export const sendSendingDomainTestAction = enhanceAction(
  async function (data, user) {
    try {
      const { accountSlug, service } = await getWritableService(
        data.accountId,
        user.id,
      );
      const domain = await service.getForAccount(data.accountId);

      if (!domain || !isSendingDomainVerified(domain)) {
        throw new SendingDomainError(
          'Verify the sending domain before sending a test email.',
        );
      }

      const admin = getSupabaseServerAdminClient();
      const { data: account } = await admin
        .from('accounts')
        .select('name')
        .eq('id', data.accountId)
        .maybeSingle();

      const accountName =
        (account as { name?: string | null } | null)?.name?.trim() ||
        domain.domain;
      const resolved = resolveWorkspaceMailFrom({
        accountName,
        sendingDomain: domain,
        platformFrom: getPlatformSesFrom(),
      });

      if (!resolved.fromHeader || !resolved.fromEmail) {
        throw new SendingDomainError('Could not resolve a From address.');
      }

      const mailer = createSesMailer();
      const result = await mailer.sendEmail({
        to: user.email,
        from: resolved.fromHeader,
        subject: `Test email from ${accountName}`,
        text:
          `This is a test send from ${resolved.fromEmail}. ` +
          'If you received this, your sending domain is ready for circulation and campaigns.',
        replyTo: resolved.replyTo ?? undefined,
        sesTenant: resolved.sesTenantName ?? undefined,
        sesConfigurationSet: resolved.sesConfigurationSet ?? undefined,
      });

      revalidateSendingDomain(accountSlug);
      return { messageId: result.messageId ?? null };
    } catch (error) {
      toActionError(error);
    }
  },
  { auth: true, schema: SendingDomainAccountSchema },
);
