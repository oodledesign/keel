import { listApiTokensForWorkspace } from '~/lib/api-tokens/api-tokens.service';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { ApiTokensSettingsCard } from './api-tokens-settings-card';

type Props = {
  accountId: string;
  accountSlug: string;
};

export async function ApiTokensSection({ accountId, accountSlug }: Props) {
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();

  const tokens = await listApiTokensForWorkspace({
    accountId,
    userId: user.id,
  });

  return (
    <ApiTokensSettingsCard
      accountId={accountId}
      accountSlug={accountSlug}
      initialTokens={tokens}
    />
  );
}
