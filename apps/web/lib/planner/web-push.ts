import 'server-only';

import webpush from 'web-push';

export type WebPushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export function getWebPushConfig(): WebPushConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'mailto:hi@ozer.so';

  if (!publicKey || !privateKey) return null;

  return { publicKey, privateKey, subject };
}

export function getVapidPublicKey(): string | null {
  return getWebPushConfig()?.publicKey ?? null;
}

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export async function sendWebPush(
  subscription: PushSubscriptionRow,
  payload: PushPayload,
): Promise<'sent' | 'gone' | 'failed'> {
  const config = getWebPushConfig();
  if (!config) {
    throw new Error('VAPID keys are not configured');
  }

  webpush.setVapidDetails(
    config.subject,
    config.publicKey,
    config.privateKey,
  );

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
    );
    return 'sent';
  } catch (err) {
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err
        ? Number((err as { statusCode?: number }).statusCode)
        : 0;

    if (statusCode === 404 || statusCode === 410) {
      return 'gone';
    }

    return 'failed';
  }
}
