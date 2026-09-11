'use client';

import { useEffect, useRef, useState } from 'react';

import { Spinner } from '@kit/ui/spinner';

import {
  type CampaignSendProgressSnapshot,
  campaignSendProgressPercent,
  isCampaignSendInFlight,
  isCampaignSendTerminal,
} from '~/lib/campaigns/campaign-send-progress';
import { workspaceText, workspaceTextMuted } from '~/lib/workspace-ui';

const POLL_MS = 1500;

export function CampaignSendProgress({
  accountId,
  campaignId,
  active,
  initial,
  seed,
  expectedAudienceCount,
  onTerminal,
}: {
  accountId: string;
  campaignId: string;
  active: boolean;
  initial?: CampaignSendProgressSnapshot | null;
  seed?: CampaignSendProgressSnapshot | null;
  expectedAudienceCount?: number;
  onTerminal?: (progress: CampaignSendProgressSnapshot) => void;
}) {
  const [progress, setProgress] = useState<CampaignSendProgressSnapshot | null>(
    seed ?? initial ?? null,
  );
  const onTerminalRef = useRef(onTerminal);
  onTerminalRef.current = onTerminal;

  useEffect(() => {
    if (seed) {
      setProgress(seed);
    }
  }, [seed]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const controller = new AbortController();
    let timer: number | undefined;
    let stopped = false;

    const tick = async () => {
      try {
        const url = new URL(
          '/api/campaigns/send-progress',
          window.location.origin,
        );
        url.searchParams.set('accountId', accountId);
        url.searchParams.set('campaignId', campaignId);
        const response = await fetch(url.toString(), {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('progress request failed');
        }
        const next = (await response.json()) as CampaignSendProgressSnapshot;
        if (stopped) {
          return;
        }
        setProgress(next);
        if (isCampaignSendTerminal(next.status)) {
          onTerminalRef.current?.(next);
          return;
        }
      } catch (error) {
        if (controller.signal.aborted || stopped) {
          return;
        }
        void error;
      }

      timer = window.setTimeout(() => {
        void tick();
      }, POLL_MS);
    };

    void tick();

    return () => {
      stopped = true;
      controller.abort();
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [active, accountId, campaignId]);

  if (!active && !progress) {
    return null;
  }

  const liveTotal = Math.max(
    progress?.audienceCount ?? 0,
    expectedAudienceCount ?? 0,
  );
  const sendingOrDone =
    Boolean(progress) &&
    (isCampaignSendInFlight(progress!.status) ||
      isCampaignSendTerminal(progress!.status));
  const percent =
    sendingOrDone && liveTotal > 0
      ? campaignSendProgressPercent({
          processedCount: progress!.processedCount,
          audienceCount: liveTotal,
        })
      : null;
  const determinate = percent !== null;
  const failed = progress?.status === 'failed';
  const sent = progress?.status === 'sent';
  const inFlight = !sent && !failed;

  const label = failed ? 'Send failed' : sent ? 'Sent' : 'Sending…';

  const detail = determinate
    ? `${(progress?.processedCount ?? 0).toLocaleString()} of ${liveTotal.toLocaleString()}`
    : 'Preparing the recipient list';

  const failedHint = failed && progress?.lastError ? progress.lastError : null;
  const extra =
    determinate && (progress?.failedCount ?? 0) > 0 && !failed
      ? ` · ${progress!.failedCount.toLocaleString()} failed`
      : '';

  return (
    <div
      className="space-y-2 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-3"
      data-test="campaign-send-progress"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={`flex min-w-0 items-center gap-2 text-sm ${workspaceText}`}
        >
          {inFlight ? (
            <Spinner className="size-4 shrink-0 text-[var(--ozer-accent)]" />
          ) : null}
          <span className="font-medium">{label}</span>
          <span className={workspaceTextMuted}>
            {detail}
            {extra}
          </span>
        </p>
        <p
          className={`shrink-0 text-sm tabular-nums ${workspaceTextMuted}`}
          data-test="campaign-send-progress-percent"
        >
          {determinate ? `${percent}%` : ''}
        </p>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--workspace-control-surface)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={determinate ? percent : undefined}
        aria-label="Campaign send progress"
      >
        {determinate ? (
          <div
            className="h-full rounded-full bg-[var(--ozer-accent)] transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        ) : (
          <div className="h-full w-full animate-pulse rounded-full bg-[var(--ozer-accent)]/70" />
        )}
      </div>
      {failedHint ? (
        <p className={`text-xs ${workspaceTextMuted}`}>{failedHint}</p>
      ) : null}
    </div>
  );
}
