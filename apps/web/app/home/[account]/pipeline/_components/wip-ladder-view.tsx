'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type { PipelineDeal } from '~/home/(user)/_lib/server/pipeline.loader';
import type { PipelineListingOption } from '~/home/(user)/pipeline/_components/pipeline-board';
import { moveDealToStage } from '~/home/(user)/pipeline/actions';
import { COMMERCIAL_PIPELINE_WON_STAGE } from '~/lib/commercial/commercial-constants';
import { normalizeCommercialPipelineStage } from '~/lib/commercial/pipeline-stage-config';
import { wipStageColour } from '~/lib/commercial/wip-stage-colours';
import {
  WIP_WORK_TYPE_LABELS,
  normalizeWipWorkType,
} from '~/lib/commercial/wip-work-type';
import { workspacePanelCard, workspaceTextMuted } from '~/lib/workspace-ui';

import { instructionTitle } from '../_lib/instruction-title';
import type { WipDeskActivityItem } from '../_lib/server/wip-attachments.actions';
import { WipAttachmentsStrip } from './wip-attachments-strip';

type StageColumn = { key: string; label: string };

type Props = {
  accountId: string;
  accountSlug: string;
  deals: PipelineDeal[];
  stages: StageColumn[];
  deskActivity: WipDeskActivityItem[];
  listings?: PipelineListingOption[];
  onDealsChange: (
    next: PipelineDeal[] | ((prev: PipelineDeal[]) => PipelineDeal[]),
  ) => void;
  onEditInstruction: (deal: PipelineDeal) => void;
  onDealWon?: (deal: PipelineDeal) => void;
  onActivityChanged?: () => void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTimelineDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}

function previewText(content: string, max = 90) {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function isWonStage(stage: string) {
  return (
    stage === COMMERCIAL_PIPELINE_WON_STAGE ||
    stage === 'completed_exchanged' ||
    stage === 'won' ||
    stage === 'signed' ||
    stage === 'completed'
  );
}

export function WipLadderView({
  accountId,
  accountSlug,
  deals,
  stages,
  deskActivity,
  listings = [],
  onDealsChange,
  onEditInstruction,
  onDealWon,
  onActivityChanged,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [, startTransition] = useTransition();

  const listingById = useMemo(() => {
    const map = new Map<string, PipelineListingOption>();
    for (const listing of listings) map.set(listing.id, listing);
    return map;
  }, [listings]);

  const latestByDeal = useMemo(() => {
    const map = new Map<string, WipDeskActivityItem>();
    for (const item of deskActivity) {
      if (!item.pipelineDealId || map.has(item.pipelineDealId)) continue;
      map.set(item.pipelineDealId, item);
    }
    return map;
  }, [deskActivity]);

  const dealsByStage = useMemo(() => {
    const map = new Map<string, PipelineDeal[]>();
    for (const stage of stages) {
      map.set(stage.key, []);
    }
    for (const deal of deals) {
      const key = normalizeCommercialPipelineStage(deal.stage);
      const list = map.get(key);
      if (list) list.push(deal);
      else map.set(key, [deal]);
    }
    return map;
  }, [deals, stages]);

  const allDealIds = useMemo(() => deals.map((deal) => deal.id), [deals]);
  const allExpanded =
    allDealIds.length > 0 && allDealIds.every((id) => expandedIds.has(id));

  const toggleExpanded = (dealId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(dealId)) next.delete(dealId);
      else next.add(dealId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(allDealIds));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const changeStage = (deal: PipelineDeal, nextStage: string) => {
    if (nextStage === deal.stage) return;
    const previousStage = deal.stage;
    const updated = { ...deal, stage: nextStage };
    onDealsChange((prev) =>
      prev.map((item) => (item.id === deal.id ? updated : item)),
    );

    startTransition(async () => {
      try {
        const result = await moveDealToStage(deal.id, nextStage, {
          accountSlug,
        });
        if (!result.success) {
          onDealsChange((prev) =>
            prev.map((item) =>
              item.id === deal.id ? { ...item, stage: previousStage } : item,
            ),
          );
          toast.error(result.error ?? 'Could not update stage');
          return;
        }
        if (isWonStage(nextStage)) {
          onDealWon?.(updated);
        }
      } catch (error) {
        onDealsChange((prev) =>
          prev.map((item) =>
            item.id === deal.id ? { ...item, stage: previousStage } : item,
          ),
        );
        toast.error(
          error instanceof Error ? error.message : 'Could not update stage',
        );
      }
    });
  };

  // Ladder climbs upward: completed / exchanged at the top.
  const ladderStages = useMemo(() => [...stages].reverse(), [stages]);

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6 md:px-6 lg:px-8">
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-xs"
          disabled={allDealIds.length === 0}
          onClick={allExpanded ? collapseAll : expandAll}
        >
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </Button>
      </div>
      {ladderStages.map((stage) => {
        const stageDeals = dealsByStage.get(stage.key) ?? [];
        const colour = wipStageColour(stage.key);
        return (
          <section
            key={stage.key}
            className={workspacePanelCard}
            style={{
              borderLeftWidth: 4,
              borderLeftColor: colour.bar,
            }}
          >
            <header
              className="flex items-center justify-between gap-3 border-b border-[color:var(--workspace-shell-border)] px-4 py-3"
              style={{ background: colour.tint }}
            >
              <h3
                className="text-sm font-semibold tracking-wide"
                style={{ color: colour.label }}
              >
                {stage.label}
              </h3>
              <span className={`text-xs tabular-nums ${workspaceTextMuted}`}>
                {stageDeals.length}
              </span>
            </header>

            {stageDeals.length === 0 ? (
              <p className={`px-4 py-3 text-sm ${workspaceTextMuted}`}>
                No instructions in this stage
              </p>
            ) : (
              <ul className="divide-y divide-[color:var(--workspace-shell-border)]/70">
                <li
                  className={`hidden border-b border-[color:var(--workspace-shell-border)]/50 px-3 py-1.5 text-[10px] font-medium tracking-wide uppercase sm:grid sm:grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_9.5rem_auto] sm:gap-3 ${workspaceTextMuted}`}
                  aria-hidden
                >
                  <span className="pl-6">Instruction</span>
                  <span>Last activity</span>
                  <span className="text-right">Value</span>
                  <span>Stage</span>
                  <span />
                </li>
                {stageDeals.map((deal) => {
                  const open = expandedIds.has(deal.id);
                  const latest = latestByDeal.get(deal.id);
                  const oneLiner =
                    previewText(latest?.content ?? '') ||
                    (deal.nextAction?.trim() ? deal.nextAction.trim() : null);
                  const listing = deal.commercialListingId
                    ? listingById.get(deal.commercialListingId)
                    : null;
                  const lastActivityIso = latest?.createdAt ?? null;

                  return (
                    <li key={deal.id}>
                      <div className="grid grid-cols-1 items-center gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_9.5rem_auto] sm:gap-3">
                        <button
                          type="button"
                          className="flex min-w-0 items-start gap-2 text-left"
                          onClick={() => toggleExpanded(deal.id)}
                          aria-expanded={open}
                          aria-label={
                            open
                              ? `Collapse ${instructionTitle(deal)}`
                              : `Expand ${instructionTitle(deal)}`
                          }
                        >
                          {open ? (
                            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
                          ) : (
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
                          )}
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-[var(--workspace-shell-text)]">
                              {instructionTitle(deal)}
                              {normalizeWipWorkType(deal.workType) &&
                              normalizeWipWorkType(deal.workType) !==
                                'agency' ? (
                                <span
                                  className={`ml-2 text-[11px] font-normal ${workspaceTextMuted}`}
                                >
                                  {
                                    WIP_WORK_TYPE_LABELS[
                                      normalizeWipWorkType(deal.workType)!
                                    ]
                                  }
                                </span>
                              ) : null}
                            </span>
                            {deal.commercialListingId && listing?.name ? (
                              <Link
                                href={pathsConfig.app.accountListingDetail
                                  .replace('[account]', accountSlug)
                                  .replace('[id]', deal.commercialListingId)}
                                onClick={(event) => event.stopPropagation()}
                                className="mt-0.5 inline-flex max-w-full truncate text-xs font-medium text-[var(--ozer-info)] underline-offset-2 hover:underline"
                              >
                                {listing.name}
                              </Link>
                            ) : null}
                            <span
                              className={`mt-0.5 block text-xs ${workspaceTextMuted}`}
                            >
                              {oneLiner ? (
                                <>
                                  {oneLiner}
                                  {latest?.assignedTo ? (
                                    <span>
                                      {' → '}
                                      {latest.assignedTo.name}
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                'No chase update yet'
                              )}
                            </span>
                          </span>
                        </button>

                        <div
                          className={`pl-6 text-xs tabular-nums sm:pl-0 ${workspaceTextMuted}`}
                          title="Last activity"
                        >
                          <span className="sm:hidden">Last activity · </span>
                          {lastActivityIso
                            ? formatTimelineDate(lastActivityIso)
                            : '—'}
                        </div>

                        <span className="pl-6 text-sm text-[var(--workspace-shell-text)] tabular-nums sm:pl-0 sm:text-right">
                          {formatCurrency(deal.value || 0)}
                        </span>

                        <div className="pl-6 sm:pl-0">
                          <Select
                            value={normalizeCommercialPipelineStage(deal.stage)}
                            onValueChange={(next) => changeStage(deal, next)}
                          >
                            <SelectTrigger className="h-8 w-full border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[100] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
                              {stages.map((option) => (
                                <SelectItem key={option.key} value={option.key}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="pl-6 sm:pl-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs text-[var(--workspace-shell-text-muted)]"
                            onClick={() => onEditInstruction(deal)}
                          >
                            Open
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {open ? (
                        <div className="border-t border-[color:var(--workspace-shell-border)]/60 bg-[var(--workspace-shell-sidebar-accent)]/25 px-4 py-3">
                          <WipAttachmentsStrip
                            accountId={accountId}
                            accountSlug={accountSlug}
                            pipelineDealId={deal.id}
                            activityOnly
                            previewCount={3}
                            onActivityChanged={onActivityChanged}
                          />
                          <div className="mt-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-[color:var(--workspace-shell-border)]"
                              onClick={() => onEditInstruction(deal)}
                            >
                              Full instruction
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
