'use client';

import { useMemo, useState } from 'react';

import { RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  applySyncMappingsToDocument,
  blocksForCalendarSync,
  hasSyncableBlocks,
} from '~/lib/planner/plan-calendar-sync';
import type { PlanDocument } from '~/lib/planner/plan-blocks';
import { syncPlannerCalendarBlocks } from '~/lib/planner/sync-calendar-client';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

type Props = {
  dateIso: string;
  planDocument: PlanDocument | null;
  onSynced?: (document: PlanDocument) => Promise<void> | void;
  className?: string;
  size?: 'default' | 'sm';
};

export function PlannerSyncCalendarButton({
  dateIso,
  planDocument,
  onSynced,
  className,
  size = 'default',
}: Props) {
  const [isSyncing, setIsSyncing] = useState(false);

  const syncBlocks = useMemo(() => {
    if (!planDocument) {
      return [];
    }

    return blocksForCalendarSync(planDocument, dateIso).filter(
      (block) =>
        !block.isBreak &&
        (!block.isCalendarEvent || Boolean(block.googleEventId)),
    );
  }, [dateIso, planDocument]);

  const showButton = planDocument ? hasSyncableBlocks(planDocument) : false;

  async function syncToCalendar() {
    if (!planDocument || syncBlocks.length === 0) {
      toast.error('No blocks ready to sync to Google Calendar');
      return;
    }

    const createCount = syncBlocks.filter((block) => !block.googleEventId).length;
    const updateCount = syncBlocks.filter((block) => block.googleEventId).length;

    const summary = [
      createCount > 0
        ? `create ${createCount} task event${createCount === 1 ? '' : 's'}`
        : null,
      updateCount > 0
        ? `update ${updateCount} event${updateCount === 1 ? '' : 's'}`
        : null,
    ]
      .filter(Boolean)
      .join(' and ');

    if (!confirm(`Sync to Google Calendar — ${summary}?`)) {
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncPlannerCalendarBlocks({
        date: dateIso,
        blocks: syncBlocks,
      });

      const nextDocument = applySyncMappingsToDocument(
        planDocument,
        result.mappings,
      );
      await onSynced?.(nextDocument);

      const parts: string[] = [];
      if (result.created > 0) {
        parts.push(`created ${result.created}`);
      }
      if (result.updated > 0) {
        parts.push(`updated ${result.updated}`);
      }

      toast.success(
        parts.length > 0
          ? `Google Calendar: ${parts.join(', ')}`
          : 'Google Calendar is up to date',
      );

      if (result.errors.length > 0) {
        toast.message(`${result.errors.length} event(s) could not be synced`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Calendar sync failed');
    } finally {
      setIsSyncing(false);
    }
  }

  if (!showButton) {
    return null;
  }

  return (
    <Button
      type="button"
      size={size}
      className={cn(workspaceBtnPrimaryMd, className)}
      disabled={isSyncing}
      onClick={syncToCalendar}
    >
      <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
      {isSyncing ? 'Syncing…' : 'Sync to Google Calendar'}
    </Button>
  );
}

/** @deprecated Use PlannerSyncCalendarButton */
export const PlannerPushToCalendarButton = PlannerSyncCalendarButton;
