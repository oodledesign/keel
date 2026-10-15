/**
 * Lead activity feed: pipeline_deal_events merged with manual updates (notes).
 */
import {
  BUILDING_SURVEYOR_PIPELINE_LABELS,
  isBuildingSurveyorPipelineStage,
} from './pipeline-stages';
import { SURVEYOR_TICK_LABELS, type SurveyorTickKey } from './surveyor-lead';

export type SurveyorLeadEvent = {
  id: string;
  eventType: string;
  fromStage: string | null;
  toStage: string | null;
  detail: Record<string, unknown>;
  /** Null for automatic changes (quote sent, contract signed, reminders). */
  actorName: string | null;
  /** Member named in the detail, such as "Checked by". */
  detailMemberName: string | null;
  createdAt: string;
};

export type LeadActivityNote = {
  id: string;
  content: string;
  createdAt: string;
  createdBy: { name: string } | null;
};

export type LeadActivityItem =
  | { kind: 'event'; id: string; at: string; text: string; actor: string }
  | { kind: 'note'; id: string; at: string; text: string; actor: string };

function stageLabel(stage: string | null) {
  if (!stage) return 'a stage';
  return isBuildingSurveyorPipelineStage(stage)
    ? BUILDING_SURVEYOR_PIPELINE_LABELS[stage]
    : stage;
}

export function describeLeadEvent(event: SurveyorLeadEvent): string {
  switch (event.eventType) {
    case 'created':
      return `Lead created in ${stageLabel(event.toStage)}`;
    case 'stage_changed':
      return `Moved from ${stageLabel(event.fromStage)} to ${stageLabel(event.toStage)}`;
    case 'archived':
      return 'Archived as unresponsive';
    case 'reminder_sent': {
      const toClient = event.detail.client === true;
      return toClient
        ? 'Quote reminder sent to the surveyor and the client'
        : 'Quote reminder sent';
    }
    case 'tick_changed': {
      const tick = event.detail.tick;
      if (tick === 'reportCheckedBy') {
        return event.detailMemberName
          ? `Report checked by ${event.detailMemberName}`
          : 'Report checker cleared';
      }
      const label =
        typeof tick === 'string' && tick in SURVEYOR_TICK_LABELS
          ? SURVEYOR_TICK_LABELS[tick as SurveyorTickKey]
          : 'Tick';
      return event.detail.value === true ? label : `${label} (cleared)`;
    }
    default:
      return 'Updated';
  }
}

/** Newest first. */
export function mergeLeadActivity(
  events: SurveyorLeadEvent[],
  notes: LeadActivityNote[],
): LeadActivityItem[] {
  const items: LeadActivityItem[] = [
    ...events.map((event) => ({
      kind: 'event' as const,
      id: `event-${event.id}`,
      at: event.createdAt,
      text: describeLeadEvent(event),
      actor: event.actorName ?? 'Automatic',
    })),
    ...notes.map((note) => ({
      kind: 'note' as const,
      id: `note-${note.id}`,
      at: note.createdAt,
      text: note.content,
      actor: note.createdBy?.name ?? 'Member',
    })),
  ];
  return items.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}
