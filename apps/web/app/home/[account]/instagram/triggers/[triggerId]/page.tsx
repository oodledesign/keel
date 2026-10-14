import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { loadIgConnectedAccount } from '~/lib/instagram-autoreply/assert-access';
import { isIgAppReviewApproved } from '~/lib/instagram-autoreply/env';
import type { IgStepType } from '~/lib/instagram-autoreply/sequence/step-types';
import type { IgTriggerFullRow } from '~/lib/instagram-autoreply/types';

import { AutomationBuilder } from '../../../(instagram-autoreply)/_components/builder/automation-builder';
import {
  type BuilderAsset,
  type BuilderTrigger,
  fromStoredStep,
  newStep,
} from '../../../(instagram-autoreply)/_components/builder/builder-model';
import { InstagramTriggerEditor } from '../../../(instagram-autoreply)/_components/instagram-trigger-editor';
import { upsertIgTrigger } from '../../../(instagram-autoreply)/_lib/server/instagram-autoreply-actions';
import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../../_lib/work-account-path';

type InstagramTriggerDetailPageProps = {
  params: Promise<{ account: string; triggerId: string }>;
  searchParams: Promise<{ builder?: string }>;
};

function toBuilderTrigger(trigger: IgTriggerFullRow | null): BuilderTrigger {
  return {
    name: trigger?.name ?? '',
    trigger_type: trigger?.trigger_type ?? 'comment_keyword',
    keywords: trigger?.keywords ?? [],
    match_mode: trigger?.match_mode ?? 'contains',
    use_regex: trigger?.match_type === 'regex',
    media_scope: trigger?.media_scope ?? 'any_post',
    media_id: trigger?.media_id ?? trigger?.target_media_ids?.[0] ?? null,
    media_preview: null,
    require_follow: trigger?.require_follow ?? false,
    once_per_contact: trigger?.once_per_contact ?? false,
    cooldown_minutes: trigger?.cooldown_minutes ?? null,
    public_reply_enabled: trigger?.public_reply_enabled ?? false,
    public_reply_mode: trigger?.public_reply_mode ?? 'static',
    public_reply_template: trigger?.public_reply_template ?? '',
    public_reply_ai_tier: trigger?.public_reply_ai_tier ?? 'standard',
    create_deal_on_match: trigger?.create_deal_on_match ?? false,
    deal_stage: trigger?.deal_stage ?? 'lead',
    is_active: trigger?.is_active ?? true,
  };
}

/** The common "comment → Send it button → voice note" starting point. */
function defaultNewSequence() {
  const ask = newStep('buttons');
  ask.config.text = 'Hey {{name}}! Want me to send it over? 🎧';
  return [ask, newStep('audio')];
}

export default async function InstagramTriggerDetailPage({
  params,
  searchParams,
}: InstagramTriggerDetailPageProps) {
  const { account, triggerId } = await params;
  const sp = await searchParams;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ADDON_APPS_SPACE_TYPES);

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const connected = await loadIgConnectedAccount(client, accountId);

  if (!connected?.is_active && triggerId === 'new') {
    redirect(workAccountPath(workPaths.accountInstagramAutoreply, account));
  }

  let trigger: IgTriggerFullRow | null = null;
  let storedSteps: Array<{
    step_type: IgStepType;
    config: Record<string, unknown>;
    asset_id: string | null;
  }> = [];

  if (triggerId !== 'new') {
    const { data, error } = await client
      .from('ig_triggers')
      .select('*')
      .eq('id', triggerId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) notFound();
    trigger = data as IgTriggerFullRow;

    const { data: steps, error: stepsError } = await client
      .from('ig_automation_steps')
      .select('step_type, config, asset_id')
      .eq('trigger_id', triggerId)
      .order('position', { ascending: true });
    if (stepsError) throw new Error(stepsError.message);
    storedSteps = (steps ?? []) as typeof storedSteps;
  }

  const triggersPath =
    pathsConfig.app.accountInstagramAutoreplyTriggers.replace(
      '[account]',
      account,
    );

  const usesLegacyAiDm =
    trigger !== null &&
    storedSteps.length === 0 &&
    trigger.dm_enabled &&
    trigger.dm_mode === 'ai_generated' &&
    sp.builder !== '1';

  const assetIds = storedSteps.flatMap((s) => (s.asset_id ? [s.asset_id] : []));
  const assets = new Map<string, BuilderAsset>();
  if (assetIds.length > 0) {
    const { data } = await client
      .from('ig_automation_assets')
      .select('id, label, kind, duration_ms, waveform')
      .eq('account_id', accountId)
      .in('id', assetIds);
    for (const asset of (data ?? []) as BuilderAsset[])
      assets.set(asset.id, asset);
  }

  const initialSteps =
    storedSteps.length > 0
      ? storedSteps.map((s) =>
          fromStoredStep(
            s,
            s.asset_id ? (assets.get(s.asset_id) ?? null) : null,
          ),
        )
      : defaultNewSequence();

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title={trigger ? trigger.name : 'New automation'}
        description="Choose what starts it, then build the messages it sends."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <div className="mx-4 lg:mx-0">
          <Link
            href={triggersPath}
            className="text-sm text-[color:var(--ozer-accent)] hover:underline"
          >
            ← Back to automations
          </Link>
        </div>

        {usesLegacyAiDm ? (
          <>
            <div className="mx-4 max-w-2xl rounded-xl border border-[color:var(--workspace-shell-border)] px-4 py-3 text-sm lg:mx-0">
              This automation sends an AI-written DM. To add voice notes,
              buttons and follow-ups,{' '}
              <Link
                href={`${triggersPath}/${triggerId}?builder=1`}
                className="text-[color:var(--ozer-accent)] hover:underline"
              >
                rebuild it as a sequence
              </Link>
              . Saving a sequence replaces the AI-written DM.
            </div>
            <InstagramTriggerEditor
              accountId={accountId}
              trigger={trigger}
              onSave={upsertIgTrigger}
            />
          </>
        ) : (
          <AutomationBuilder
            accountId={accountId}
            triggerId={trigger?.id ?? null}
            initialTrigger={toBuilderTrigger(trigger)}
            initialSteps={initialSteps}
            businessUsername={
              (connected as { ig_username: string | null } | null)
                ?.ig_username ?? null
            }
            appReviewApproved={isIgAppReviewApproved()}
            backHref={triggersPath}
          />
        )}
      </PageBody>
    </>
  );
}
