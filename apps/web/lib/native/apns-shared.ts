export type NativeInvoicePushKind = 'paid' | 'overdue' | 'viewed';

export type NativeInvoicePushPayload = {
  title: string;
  body: string;
  invoiceId: string;
  url: string;
};

export function nativeInvoicePushUrl(invoiceId: string) {
  return `so.ozer.app://invoice/${invoiceId}`;
}

export function buildNativeInvoicePushPayload(input: {
  kind: NativeInvoicePushKind;
  invoiceId: string;
  invoiceNumber: string;
  body: string;
}): NativeInvoicePushPayload {
  const title =
    input.kind === 'paid'
      ? 'Invoice paid'
      : input.kind === 'overdue'
        ? 'Invoice overdue'
        : 'Invoice viewed';

  return {
    title,
    body: input.body,
    invoiceId: input.invoiceId,
    url: nativeInvoicePushUrl(input.invoiceId),
  };
}

export function readApnsConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const keyId = env.APNS_KEY_ID?.trim();
  const teamId = env.APNS_TEAM_ID?.trim() || '463T9J3286';
  const bundleId = env.APNS_BUNDLE_ID?.trim() || 'so.ozer.app';
  const rawKey = env.APNS_P8?.trim() || '';
  const keyPath = env.APNS_P8_PATH?.trim() || '';
  const production =
    env.APNS_PRODUCTION === 'true' || env.APNS_ENVIRONMENT === 'production';

  if (!keyId || (!rawKey && !keyPath)) {
    return null;
  }

  return {
    keyId,
    teamId,
    bundleId,
    rawKey: rawKey.replace(/\\n/g, '\n'),
    keyPath,
    host: production ? 'api.push.apple.com' : 'api.sandbox.push.apple.com',
  };
}
