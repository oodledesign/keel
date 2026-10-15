'use client';

import { useState } from 'react';

import { Input } from '@kit/ui/input';
import { Switch } from '@kit/ui/switch';

import type { PipelineDeal } from '~/home/(user)/_lib/server/pipeline.loader';
import {
  EMPTY_SURVEYOR_LEAD,
  SURVEYOR_LEAD_SURVEY_TYPES,
  type SurveyorPipelineSettings,
  type SurveyorTickInput,
} from '~/lib/building-surveyor/surveyor-lead';
import {
  joinLocalDateTime,
  leadAddressLine,
  splitLocalDateTime,
} from '~/lib/building-surveyor/surveyor-lead-draft';
import { workspaceLinkAccent, workspaceTextMuted } from '~/lib/workspace-ui';

import { LeadTrafficLight, idleLabel } from './lead-traffic-light';
import {
  type SurveyorMember,
  SurveyorStageTicks,
} from './surveyor-stage-ticks';

export type SurveyorSheetPatch = {
  value?: number;
  surveyType?: string | null;
  inspectionAt?: string | null;
};

const cellSelect =
  'h-8 w-full min-w-[7rem] rounded-md border border-transparent bg-transparent px-1.5 text-sm text-[var(--workspace-shell-text)] hover:border-[color:var(--workspace-control-border)] focus:border-[color:var(--workspace-control-border)] focus:bg-[var(--workspace-control-surface)]';

const cellInput =
  'h-8 border-transparent bg-transparent px-1.5 shadow-none hover:border-[color:var(--workspace-control-border)] focus-visible:bg-[var(--workspace-control-surface)]';

function FeeCell({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(value ? String(value) : '');
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    setText(value ? String(value) : '');
  }
  const commit = () => {
    const parsed = Number(text.replace(/[£,\s]/g, '') || 0);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setText(value ? String(value) : '');
      return;
    }
    const rounded = Math.round(parsed);
    if (rounded !== value) onCommit(rounded);
  };
  return (
    <Input
      aria-label="Fee"
      inputMode="decimal"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
      className={`${cellInput} w-24`}
    />
  );
}

export function SurveyorLeadSheet({
  deals,
  stages,
  settings,
  members,
  includeLost,
  onIncludeLostChange,
  onOpen,
  onMoveStage,
  onTicks,
  onPatch,
}: {
  deals: PipelineDeal[];
  stages: ReadonlyArray<{ key: string; label: string }>;
  settings: SurveyorPipelineSettings;
  members: SurveyorMember[];
  includeLost: boolean;
  onIncludeLostChange: (next: boolean) => void;
  onOpen: (deal: PipelineDeal) => void;
  onMoveStage: (deal: PipelineDeal, stage: string) => void;
  onTicks: (deal: PipelineDeal, input: SurveyorTickInput) => void;
  onPatch: (deal: PipelineDeal, patch: SurveyorSheetPatch) => void;
}) {
  return (
    <div className="px-4 md:px-6 lg:px-8">
      <div className="mb-3 flex items-center justify-end gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
        <Switch
          id="surveyor-sheet-include-lost"
          checked={includeLost}
          onCheckedChange={onIncludeLostChange}
        />
        <label htmlFor="surveyor-sheet-include-lost">Include lost</label>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-[color:var(--workspace-shell-border)] text-xs text-[var(--workspace-shell-text-muted)]">
            <tr>
              <th className="px-3 py-2.5 font-medium">Client</th>
              <th className="px-3 py-2.5 font-medium">Address</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 font-medium">Stage</th>
              <th className="px-3 py-2.5 font-medium">Fee (£)</th>
              <th className="px-3 py-2.5 font-medium">Inspection</th>
              <th className="px-3 py-2.5 font-medium">Ticks</th>
              <th className="px-3 py-2.5 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {deals.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className={`px-3 py-10 text-center text-xs ${workspaceTextMuted}`}
                >
                  No leads to show.
                </td>
              </tr>
            ) : (
              deals.map((deal) => {
                const lead = deal.surveyorLead ?? EMPTY_SURVEYOR_LEAD;
                const inspection = splitLocalDateTime(lead.inspectionAt);
                const address = leadAddressLine(deal) || deal.companyName;
                return (
                  <tr
                    key={deal.id}
                    className="border-b border-[color:var(--workspace-shell-border)] last:border-b-0"
                  >
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => onOpen(deal)}
                        className={`max-w-[12rem] truncate text-left font-medium ${workspaceLinkAccent}`}
                      >
                        {deal.contactName || 'Unnamed lead'}
                      </button>
                    </td>
                    <td className="max-w-[16rem] truncate px-3 py-1.5 text-[var(--workspace-shell-text)]">
                      {address || (
                        <span className={workspaceTextMuted}>No address</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5">
                      <select
                        aria-label="Instruction type"
                        className={cellSelect}
                        value={lead.surveyType ?? ''}
                        onChange={(event) =>
                          onPatch(deal, {
                            surveyType: event.target.value || null,
                          })
                        }
                      >
                        <option value="">Not set</option>
                        {SURVEYOR_LEAD_SURVEY_TYPES.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1.5 py-1.5">
                      <select
                        aria-label="Stage"
                        className={cellSelect}
                        value={deal.stage}
                        onChange={(event) =>
                          onMoveStage(deal, event.target.value)
                        }
                      >
                        {stages.map((stage) => (
                          <option key={stage.key} value={stage.key}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1.5 py-1.5">
                      <FeeCell
                        value={deal.value}
                        onCommit={(value) => onPatch(deal, { value })}
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <Input
                        aria-label="Inspection date"
                        type="date"
                        value={inspection.date}
                        onChange={(event) =>
                          onPatch(deal, {
                            inspectionAt: joinLocalDateTime(
                              event.target.value,
                              inspection.time,
                            ),
                          })
                        }
                        className={`${cellInput} w-36`}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <SurveyorStageTicks
                        stage={deal.stage}
                        ticks={lead}
                        members={members}
                        onChange={(input) => onTicks(deal, input)}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
                        <LeadTrafficLight
                          lastActivityAt={lead.lastActivityAt}
                          settings={settings}
                        />
                        {idleLabel(lead.lastActivityAt)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
