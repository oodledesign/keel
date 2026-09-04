'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { createSesIdentityAdmin, createSesMailer } from '@kit/ses';
import { getLogger } from '@kit/shared/logger';
import { insertPlatformEmailLog } from '@kit/supabase/platform-email-log';
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
  return { accountSlug, service, admin };
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
        sendingSubdomain: data.sendingSubdomain,
      });

      logger.info({ ...ctx, domain: result.domain }, 'Sending domain created');
      revalidateSendingDomain(accountSlug);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : null;
      logger.error(
        {
          ...ctx,
          errorName: err?.name,
          errorMessage: err?.message ?? String(error),
          causeName:
            err?.cause instanceof Error ? err.cause.name : undefined,
        },
        'Failed to add sending domain',
      );
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
      const removed = await service.removeDomain(data.accountId);
      if (removed.sesCleanupFailed) {
        logger.warn(
          { ...ctx, error: removed.sesCleanupFailed },
          'Sending domain removed from workspace; mail-provider cleanup failed',
        );
      } else {
        logger.info(ctx, 'Sending domain removed');
      }
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
      const { accountSlug, service, admin } = await getWritableService(
        data.accountId,
        user.id,
      );
      const domain = await service.getForAccount(data.accountId);

      if (!domain || !isSendingDomainVerified(domain)) {
        throw new SendingDomainError(
          'Verify the sending domain before sending a test email.',
        );
      }

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
      const subject = `Test email from ${accountName}`;
      let status: 'sent' | 'failed' = 'sent';
      let errorMessage: string | null = null;
      let messageId: string | null = null;

      try {
        const result = await mailer.sendEmail({
          to: user.email,
          from: resolved.fromHeader,
          subject,
          text:
            `This is a test send from ${resolved.fromEmail}. ` +
            'If you received this, your sending domain is ready for circulation and campaigns.',
          replyTo: resolved.replyTo ?? undefined,
          sesTenant: resolved.sesTenantName ?? undefined,
          sesConfigurationSet: resolved.sesConfigurationSet ?? undefined,
        });
        messageId = result.messageId ?? null;
      } catch (error) {
        status = 'failed';
        errorMessage = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        await insertPlatformEmailLog({
          emailType: 'sending_domain_test',
          accountId: data.accountId,
          recipientEmail: user.email,
          senderEmail: resolved.fromEmail,
          subject,
          status,
          errorMessage,
          metadata: {
            provider: 'ses',
            ses_message_id: messageId,
            ses_tenant: resolved.sesTenantName,
            domain: domain.domain,
          },
        });
      }

      revalidateSendingDomain(accountSlug);
      return { messageId };
    } catch (error) {
      toActionError(error);
    }
  },
  { auth: true, schema: SendingDomainAccountSchema },
);
