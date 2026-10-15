'use client';

import { Checkbox } from '@kit/ui/checkbox';
import { cn } from '@kit/ui/utils';

import {
  BUILDING_SURVEYOR_PIPELINE_LABELS,
  isBuildingSurveyorPipelineStage,
} from '~/lib/building-surveyor/pipeline-stages';
import {
  SURVEYOR_STAGE_TICKS,
  type SurveyorLeadTicks,
  type SurveyorTickInput,
  type SurveyorTickKey,
} from '~/lib/building-surveyor/surveyor-lead';

export type SurveyorMember = { id: string; name: string };

const SHORT_TICK_LABELS: Record<SurveyorTickKey, string> = {
  quoteSentByPhone: 'Phone',
  quoteSentByEmail: 'Email',
  tobSigned: 'Signed',
  reportChecked: 'Checked',
};

const selectClass =
  'h-7 rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-2 text-xs text-[var(--workspace-shell-text)]';

function TickRow({
  stageKey,
  ticks,
  members,
  disabled,
  compact,
  onChange,
}: {
  stageKey: keyof typeof SURVEYOR_STAGE_TICKS;
  ticks: SurveyorLeadTicks;
  members: SurveyorMember[];
  disabled?: boolean;
  compact?: boolean;
  onChange: (next: SurveyorTickInput) => void;
}) {
  const keys = SURVEYOR_STAGE_TICKS[stageKey] ?? [];
  const checkedByName =
    members.find((member) => member.id === ticks.reportCheckedBy)?.name ?? null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {keys.map((key) => (
        <label
          key={key}
          className="flex items-center gap-1.5 text-xs text-[var(--workspace-shell-text)]"
        >
          <Checkbox
            checked={ticks[key]}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onChange({ [key]: checked === true } as SurveyorTickInput)
            }
          />
          {SHORT_TICK_LABELS[key]}
        </label>
      ))}
      {keys.includes('reportChecked') && ticks.reportChecked ? (
        compact ? (
          checkedByName ? (
            <span className="text-xs text-[var(--workspace-shell-text-muted)]">
              by {checkedByName}
            </span>
          ) : null
        ) : (
          <label className="flex items-center gap-1.5 text-xs text-[var(--workspace-shell-text-muted)]">
            Checked by
            <select
              className={selectClass}
              value={ticks.reportCheckedBy ?? ''}
              disabled={disabled}
              onChange={(event) =>
                onChange({ reportCheckedBy: event.target.value || null })
              }
            >
              <option value="">Select</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        )
      ) : null}
    </div>
  );
}

/** Ticks for the lead's current stage (cards and sheet rows). */
export function SurveyorStageTicks({
  stage,
  ticks,
  members,
  disabled,
  onChange,
  className,
}: {
  stage: string;
  ticks: SurveyorLeadTicks;
  members: SurveyorMember[];
  disabled?: boolean;
  onChange: (next: SurveyorTickInput) => void;
  className?: string;
}) {
  if (!isBuildingSurveyorPipelineStage(stage) || !SURVEYOR_STAGE_TICKS[stage]) {
    return null;
  }
  return (
    <div className={className}>
      <TickRow
        stageKey={stage}
        ticks={ticks}
        members={members}
        disabled={disabled}
        compact
        onChange={onChange}
      />
    </div>
  );
}

/** Every tick group, for the lead form. */
export function SurveyorTicksPanel({
  stage,
  ticks,
  members,
  disabled,
  onChange,
}: {
  stage: string;
  ticks: SurveyorLeadTicks;
  members: SurveyorMember[];
  disabled?: boolean;
  onChange: (next: SurveyorTickInput) => void;
}) {
  const groups = Object.keys(SURVEYOR_STAGE_TICKS) as Array<
    keyof typeof SURVEYOR_STAGE_TICKS
  >;
  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <div
          key={group}
          className={cn(
            'flex flex-wrap items-center justify-between gap-2 rounded-lg px-2.5 py-2',
            group === stage
              ? 'bg-[var(--workspace-shell-sidebar-accent)]'
              : 'bg-transparent',
          )}
        >
          <span className="text-xs font-medium text-[var(--workspace-shell-text)]">
            {BUILDING_SURVEYOR_PIPELINE_LABELS[group]}
          </span>
          <TickRow
            stageKey={group}
            ticks={ticks}
            members={members}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
      ))}
    </div>
  );
}
