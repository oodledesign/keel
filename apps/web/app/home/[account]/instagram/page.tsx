import Link from 'next/link';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import {
  loadIgConnectedAccount,
  loadIgTriggers,
} from '~/lib/instagram-autoreply/assert-access';
import {
  getOptionalMetaInstagram,
  isIgAppReviewApproved,
} from '~/lib/instagram-autoreply/env';
import { parseIgMessengerProfile } from '~/lib/instagram-autoreply/messenger-profile';
import { parseIgVoiceSettings } from '~/lib/instagram-autoreply/types';

import {
  InstagramConnectPanel,
  InstagramOauthBanner,
} from '../(instagram-autoreply)/_components/instagram-connect-panel';
import { InstagramMessengerProfilePanel } from '../(instagram-autoreply)/_components/instagram-messenger-profile-panel';
import { InstagramSubnav } from '../(instagram-autoreply)/_components/instagram-subnav';
import { InstagramVoiceSettingsForm } from '../(instagram-autoreply)/_components/instagram-voice-settings-form';
import {
  disconnectIgAccount,
  previewIgReply,
  updateIgVoiceSettings,
} from '../(instagram-autoreply)/_lib/server/instagram-autoreply-actions';
import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../_lib/work-account-path';

type InstagramHomePageProps = {
  params: Promise<{ account: string }>;
  searchParams: Promise<{
    instagram_error?: string;
    instagram_connected?: string;
  }>;
};

export default async function InstagramHomePage({
  params,
  searchParams,
}: InstagramHomePageProps) {
  const { account } = await params;
  const sp = await searchParams;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ADDON_APPS_SPACE_TYPES);

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const connected = await loadIgConnectedAccount(client, accountId);
  const triggers = await loadIgTriggers(client, accountId);

  let oauthError: string | null = null;
  if (sp.instagram_error) {
    try {
      oauthError = decodeURIComponent(sp.instagram_error);
    } catch {
      oauthError = sp.instagram_error;
    }
  }

  const voiceSettings = parseIgVoiceSettings(
    (connected as { voice_settings?: unknown } | null)?.voice_settings,
  );

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Instagram"
        description="Connect your account, set your voice, and automate comment and DM replies."
      />
      <PageBody className="space-y-8 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <InstagramSubnav account={account} />
        <InstagramOauthBanner
          error={oauthError}
          success={Boolean(sp.instagram_connected)}
        />

        <InstagramConnectPanel
          accountId={accountId}
          accountSlug={account}
          connected={
            connected
              ? {
                  ig_username: (connected as { ig_username: string | null })
                    .ig_username,
                  token_expires_at: (
                    connected as { token_expires_at: string | null }
                  ).token_expires_at,
                  is_active: (connected as { is_active: boolean }).is_active,
                }
              : null
          }
          instagramConfigured={getOptionalMetaInstagram() !== null}
          onDisconnect={disconnectIgAccount}
        />

        {connected?.is_active ? (
          <InstagramVoiceSettingsForm
            accountId={accountId}
            initial={voiceSettings}
            onSave={updateIgVoiceSettings}
            onPreview={previewIgReply}
          />
        ) : null}

        {connected?.is_active ? (
          <InstagramMessengerProfilePanel
            accountId={accountId}
            initial={parseIgMessengerProfile(
              (connected as { messenger_profile?: unknown }).messenger_profile,
            )}
            triggers={triggers.map((t) => ({
              id: t.id as string,
              name: t.name as string,
              trigger_type: t.trigger_type as string,
            }))}
            appReviewApproved={isIgAppReviewApproved()}
          />
        ) : null}

        <div className="mx-4 text-sm lg:mx-0">
          <Link
            href={workAccountPath(
              workPaths.accountInstagramAutoreplyTriggers,
              account,
            )}
            className="rounded-lg border border-[color:var(--workspace-shell-border)] px-4 py-2"
          >
            Automations ({triggers.length})
          </Link>
        </div>
      </PageBody>
    </>
  );
}
