import { listApiTokensForWorkspace } from '~/lib/api-tokens/api-tokens.service';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { ApiTokensSettingsCard } from './api-tokens-settings-card';

type Props = {
  accountId: string;
  accountSlug: string;
};

export async function ApiTokensSection({ accountId, accountSlug }: Props) {
  const user = await requireUserInServerComponent();

  let tokens: Awaited<ReturnType<typeof listApiTokensForWorkspace>> = [];

  try {
    tokens = await listApiTokensForWorkspace({
      accountId,
      userId: user.id,
    });
  } catch {
    return (
      <p className="text-sm text-muted-foreground">
        API tokens are not available yet. Apply the latest database migrations,
        then refresh this page.
      </p>
    );
  }

  return (
    <ApiTokensSettingsCard
      accountId={accountId}
      accountSlug={accountSlug}
      initialTokens={tokens}
    />
  );
}
