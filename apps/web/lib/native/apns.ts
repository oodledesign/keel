import 'server-only';

import { SignJWT, importPKCS8 } from 'jose';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  type NativeInvoicePushKind,
  type NativeInvoicePushPayload,
  buildNativeInvoicePushPayload,
  readApnsConfig,
} from './apns-shared';

export {
  buildNativeInvoicePushPayload,
  nativeInvoicePushUrl,
  readApnsConfig,
} from './apns-shared';
export type {
  NativeInvoicePushKind,
  NativeInvoicePushPayload,
} from './apns-shared';

function decodePem(pem: string) {
  return pem.includes('BEGIN PRIVATE KEY')
    ? pem
    : `-----BEGIN PRIVATE KEY-----\n${pem}\n-----END PRIVATE KEY-----`;
}

async function loadApnsKey(
  config: NonNullable<ReturnType<typeof readApnsConfig>>,
) {
  if (config.rawKey) {
    return importPKCS8(decodePem(config.rawKey), 'ES256');
  }

  const { readFile } = await import('node:fs/promises');
  const pem = await readFile(config.keyPath, 'utf8');
  return importPKCS8(decodePem(pem), 'ES256');
}

async function apnsJwt(config: NonNullable<ReturnType<typeof readApnsConfig>>) {
  const key = await loadApnsKey(config);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt()
    .sign(key);
}

async function postApnsNotification(input: {
  token: string;
  jwt: string;
  host: string;
  bundleId: string;
  payload: NativeInvoicePushPayload;
}) {
  const { connect } = await import('node:http2');

  await new Promise<void>((resolve, reject) => {
    const client = connect(`https://${input.host}`);
    client.on('error', reject);

    const request = client.request({
      ':method': 'POST',
      ':path': `/3/device/${input.token}`,
      authorization: `bearer ${input.jwt}`,
      'apns-topic': input.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    });

    let status = 0;
    let body = '';

    request.on('response', (headers) => {
      status = Number(headers[':status'] ?? 0);
    });
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      client.close();
      if (status >= 200 && status < 300) {
        resolve();
        return;
      }
      reject(new Error(`APNs ${status || 'error'}: ${body || 'no body'}`));
    });
    request.on('error', reject);
    request.end(
      JSON.stringify({
        aps: {
          alert: {
            title: input.payload.title,
            body: input.payload.body,
          },
          sound: 'default',
        },
        invoice_id: input.payload.invoiceId,
        url: input.payload.url,
      }),
    );
  });
}

async function loadAccountDeviceTokens(accountId: string) {
  const admin = getSupabaseServerAdminClient();
  const { data: members, error: membersError } = await admin
    .from('accounts_memberships')
    .select('user_id')
    .eq('account_id', accountId);

  if (membersError) {
    throw new Error(membersError.message);
  }

  const userIds = [
    ...new Set(
      (members ?? [])
        .map((row) => row.user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (userIds.length === 0) {
    return [];
  }

  const { data: devices, error: devicesError } = await admin
    .from('native_device_tokens' as never)
    .select('token, platform')
    .in('user_id', userIds)
    .eq('platform', 'ios');

  if (devicesError) {
    throw new Error(devicesError.message);
  }

  return ((devices ?? []) as Array<{ token?: string | null }>)
    .map((row) => row.token)
    .filter((token): token is string => Boolean(token));
}

/**
 * Best-effort APNs send for invoice events. Missing credentials or send
 * failures are logged and never thrown to the caller.
 */
export async function sendNativeInvoicePush(input: {
  accountId: string;
  kind: NativeInvoicePushKind;
  invoiceId: string;
  invoiceNumber: string;
  body: string;
}) {
  const config = readApnsConfig();
  if (!config) {
    console.info('[native/apns] APNs env not set; skipping send');
    return;
  }

  try {
    const tokens = await loadAccountDeviceTokens(input.accountId);
    if (tokens.length === 0) {
      return;
    }

    const jwt = await apnsJwt(config);
    const payload = buildNativeInvoicePushPayload(input);

    await Promise.allSettled(
      tokens.map((token) =>
        postApnsNotification({
          token,
          jwt,
          host: config.host,
          bundleId: config.bundleId,
          payload,
        }).catch((error) => {
          console.warn('[native/apns] send failed', {
            invoiceId: input.invoiceId,
            error: error instanceof Error ? error.message : String(error),
          });
        }),
      ),
    );
  } catch (error) {
    console.warn('[native/apns] skipped', {
      accountId: input.accountId,
      invoiceId: input.invoiceId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
