import {
  type CampaignSendSettings,
  isSesThrottleError,
  runWithSendRate,
} from './campaign-send-worker';

export type DrainRecipient = {
  id: string;
  email: string;
  displayName: string | null;
  preferenceId: string | null;
  unsubscribeToken: string | null;
  abVariant: 'a' | 'b' | null;
};

export type RecipientClaimPatch =
  | {
      kind: 'sent';
      messageId: string | null;
      unsubscribeToken: string;
      sentAt: string;
    }
  | { kind: 'skipped'; reason: string }
  | { kind: 'failed'; message: string }
  | { kind: 'throttled'; retryAt: string }
  | { kind: 'release' };

export function claimPatch(
  patch: RecipientClaimPatch,
): Record<string, unknown> {
  switch (patch.kind) {
    case 'sent':
      return {
        status: 'sent',
        ses_message_id: patch.messageId,
        sent_at: patch.sentAt,
        unsubscribe_token: patch.unsubscribeToken,
        claim_token: null,
        claim_expires_at: null,
        error_message: null,
      };
    case 'skipped':
      return {
        status: 'skipped',
        skip_reason: patch.reason,
        claim_token: null,
        claim_expires_at: null,
      };
    case 'failed':
      return {
        status: 'failed',
        error_message: patch.message,
        claim_token: null,
        claim_expires_at: null,
      };
    case 'throttled':
      return {
        claim_token: null,
        claim_expires_at: patch.retryAt,
      };
    case 'release':
      return {
        claim_token: null,
        claim_expires_at: null,
      };
  }
}

export type MailingPreferenceSnapshot = {
  marketingStatus?: string | null;
  unsubscribeToken?: string | null;
};

/**
 * Send one claimed wave. Skips and hard failures clear the lease.
 * A throttle error leaves the row pending, pushes its lease into the future,
 * and releases every recipient this wave has not started.
 */
export async function deliverClaimedRecipients(input: {
  recipients: DrainRecipient[];
  settings: Pick<CampaignSendSettings, 'ratePerSecond' | 'concurrency'>;
  throttleBackoffSeconds: number;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  preferenceById: Map<string, MailingPreferenceSnapshot>;
  send: (
    recipient: DrainRecipient,
    unsubscribeToken: string,
  ) => Promise<{ messageId: string | null }>;
  persist: (
    recipientId: string,
    patch: RecipientClaimPatch,
  ) => Promise<boolean>;
}): Promise<{
  sent: number;
  skipped: number;
  failed: number;
  throttled: boolean;
  throttleMessage: string | null;
}> {
  const now = input.now ?? (() => new Date());
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let throttled = false;
  let throttleMessage: string | null = null;
  const sendable: Array<DrainRecipient & { token: string }> = [];

  for (const recipient of input.recipients) {
    const preference = recipient.preferenceId
      ? (input.preferenceById.get(recipient.preferenceId) ?? null)
      : null;
    const status = preference?.marketingStatus;
    const token =
      recipient.unsubscribeToken || preference?.unsubscribeToken || null;

    if (recipient.preferenceId && status && status !== 'subscribed') {
      if (
        await input.persist(recipient.id, {
          kind: 'skipped',
          reason: 'unsubscribed',
        })
      ) {
        skipped += 1;
      }
      continue;
    }

    if (!token) {
      if (
        await input.persist(recipient.id, {
          kind: 'skipped',
          reason: 'missing_unsubscribe_token',
        })
      ) {
        skipped += 1;
      }
      continue;
    }

    sendable.push({ ...recipient, token });
  }

  const { unprocessed } = await runWithSendRate({
    items: sendable,
    ratePerSecond: input.settings.ratePerSecond,
    concurrency: input.settings.concurrency,
    now: () => now().getTime(),
    sleep: input.sleep,
    stop: () => throttled,
    run: async (recipient) => {
      try {
        const result = await input.send(recipient, recipient.token);
        const applied = await input.persist(recipient.id, {
          kind: 'sent',
          messageId: result.messageId,
          unsubscribeToken: recipient.token,
          sentAt: now().toISOString(),
        });
        if (applied) sent += 1;
      } catch (error) {
        if (isSesThrottleError(error)) {
          throttled = true;
          throttleMessage =
            error instanceof Error
              ? error.message
              : 'SES sending rate exceeded';
          await input.persist(recipient.id, {
            kind: 'throttled',
            retryAt: new Date(
              now().getTime() + input.throttleBackoffSeconds * 1000,
            ).toISOString(),
          });
          return;
        }

        const applied = await input.persist(recipient.id, {
          kind: 'failed',
          message: error instanceof Error ? error.message : 'Send failed',
        });
        if (applied) failed += 1;
      }
    },
  });

  for (const recipient of unprocessed) {
    await input.persist(recipient.id, { kind: 'release' });
  }

  return { sent, skipped, failed, throttled, throttleMessage };
}
