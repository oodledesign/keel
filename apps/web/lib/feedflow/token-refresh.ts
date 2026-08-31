import 'server-only';

import { createFeedflowAdminClient } from '~/lib/feedflow/admin';
import { decryptSecret, encryptSecret } from '~/lib/feedflow/crypto-tokens';
import { refreshInstagramLongLived } from '~/lib/feedflow/instagram';
import { isInstagramTokenDueForRefresh } from '~/lib/feedflow/token-refresh-policy';

export {
  INSTAGRAM_TOKEN_EXPIRY_WINDOW_MS,
  INSTAGRAM_TOKEN_MIN_AGE_MS,
  INSTAGRAM_TOKEN_REFRESH_AFTER_MS,
  isInstagramTokenDueForRefresh,
} from '~/lib/feedflow/token-refresh-policy';

export type TokenRefreshAccount = {
  id: string;
  account_id: string;
  access_token: string;
  token_expires_at: string | null;
  last_refreshed_at: string | null;
  connected_at: string | null;
  created_at: string | null;
  token_status: string | null;
};

function isPermanentTokenFailure(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('expired') ||
    lower.includes('invalid') ||
    lower.includes('revoked') ||
    lower.includes('session has been invalidated')
  );
}

export async function refreshDueInstagramTokens(): Promise<{
  scanned: number;
  refreshed: number;
  failed: number;
  skipped: number;
}> {
  const admin = createFeedflowAdminClient();
  const { data: accounts, error } = await admin
    .from('social_accounts')
    .select(
      'id, account_id, access_token, token_expires_at, last_refreshed_at, connected_at, created_at, token_status, provider, platform',
    )
    .or('provider.eq.instagram,platform.eq.instagram');

  if (error) {
    throw new Error(error.message);
  }

  let refreshed = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of (accounts ?? []) as TokenRefreshAccount[]) {
    if (!isInstagramTokenDueForRefresh(row)) {
      skipped += 1;
      continue;
    }

    try {
      const plain = decryptSecret(row.access_token);
      const result = await refreshInstagramLongLived(plain);
      const enc = encryptSecret(result.accessToken);
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + Math.max(result.expiresIn, 3600) * 1000,
      ).toISOString();

      const { error: updateError } = await admin
        .from('social_accounts')
        .update({
          access_token: enc,
          token_expires_at: expiresAt,
          last_refreshed_at: now.toISOString(),
          token_status: 'active',
        })
        .eq('id', row.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      await admin.from('token_refresh_log').insert({
        account_id: row.account_id,
        social_account_id: row.id,
        platform: 'instagram',
        success: true,
        error_message: null,
      });

      refreshed += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Instagram token refresh failed';
      const status = isPermanentTokenFailure(message)
        ? 'needs_reauth'
        : 'error';

      await admin
        .from('social_accounts')
        .update({ token_status: status })
        .eq('id', row.id);

      await admin.from('token_refresh_log').insert({
        account_id: row.account_id,
        social_account_id: row.id,
        platform: 'instagram',
        success: false,
        error_message: message,
      });

      failed += 1;
    }
  }

  return {
    scanned: accounts?.length ?? 0,
    refreshed,
    failed,
    skipped,
  };
}
