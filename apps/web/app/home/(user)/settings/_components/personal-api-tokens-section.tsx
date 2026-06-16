import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { listApiTokensForUser } from '~/lib/api-tokens/api-tokens.service';
import { loadRecorderUsageSummary } from '~/lib/recorder/access';
import { getPersonalAccountId } from '~/lib/recorder/personal-account';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { ApiTokensSettingsCard } from '~/home/[account]/settings/_components/api-tokens-settings-card';

export async function PersonalApiTokensSection() {
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();
  const personalAccountId = await getPersonalAccountId(client, user.id);

  if (!personalAccountId) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Personal account not found.
      </p>
    );
  }

  let tokens: Awaited<ReturnType<typeof listApiTokensForUser>> = [];
  let usage: Awaited<ReturnType<typeof loadRecorderUsageSummary>> | null = null;

  try {
    [tokens, usage] = await Promise.all([
      listApiTokensForUser({ userId: user.id }),
      loadRecorderUsageSummary(client, user.id),
    ]);
  } catch {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Desktop recorder settings are not available yet. Apply the latest database
        migrations, then refresh this page.
      </p>
    );
  }

  return (
    <ApiTokensSettingsCard
      accountId={personalAccountId}
      scope="personal"
      initialTokens={tokens}
      usageSummary={usage}
    />
  );
}
