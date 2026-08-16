import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { DashboardPresetSelector } from '~/home/[account]/_components/dashboard-preset-selector';
import { recommendDashboardPreset } from '~/home/[account]/_lib/recommend-dashboard-preset';
import { loadWorkspaceDashboardPreset } from '~/home/[account]/_lib/server/dashboard-preset.loader';
import { loadWorkspaceShortcutsSettings } from '~/lib/dashboard-shortcuts/load-shortcuts';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { WorkspaceDashboardShortcutsSettingsForm } from './workspace-dashboard-shortcuts-settings-form';

type Props = {
  accountId: string;
  accountSlug: string;
  /** When true, show work-dashboard layout presets above shortcuts. */
  showLayoutPresets?: boolean;
};

export async function WorkspaceDashboardShortcutsSection({
  accountId,
  accountSlug,
  showLayoutPresets = false,
}: Props) {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();
  const data = await loadWorkspaceShortcutsSettings(client, user.id, accountId);

  let presetBlock: React.ReactNode = null;

  if (showLayoutPresets) {
    const [presetId, membershipResult] = await Promise.all([
      loadWorkspaceDashboardPreset(accountId),
      client
        .from('accounts_memberships')
        .select('account_role, seat_kind')
        .eq('account_id', accountId)
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    const membership = membershipResult.data as {
      account_role?: string | null;
      seat_kind?: string | null;
    } | null;

    const recommendedPresetId = recommendDashboardPreset({
      accountRole: membership?.account_role ?? null,
      seatKind: membership?.seat_kind ?? null,
      hasRecentPipelineActivity: false,
      openSupportTicketCount: 0,
      hasRecentInvoiceActivity: false,
    });

    presetBlock = (
      <div className="space-y-3 border-b border-[color:var(--workspace-shell-border)] pb-5">
        <div>
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Layout
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Choose how cards are ordered on your dashboard. One click applies
            the layout immediately.
          </p>
        </div>
        <DashboardPresetSelector
          accountId={accountId}
          accountSlug={accountSlug}
          activePresetId={presetId}
          recommendedPresetId={recommendedPresetId}
          compact
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {presetBlock}
      <WorkspaceDashboardShortcutsSettingsForm
        accountId={accountId}
        accountSlug={accountSlug}
        initialShortcuts={data.shortcuts}
        initialMobileNavShortcuts={data.mobileNavShortcuts}
      />
    </div>
  );
}
