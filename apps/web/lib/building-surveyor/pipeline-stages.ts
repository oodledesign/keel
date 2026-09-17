/**
 * Enquiry → quote → booking stages for Building Surveyor workspaces.
 * Stored on the shared pipeline_deals.stage column.
 */
export const BUILDING_SURVEYOR_PIPELINE_STAGES = [
  'enquiry',
  'quoted',
  'accepted',
  'booked',
  'surveyed',
  'reported',
  'lost',
] as const;

export type BuildingSurveyorPipelineStage =
  (typeof BUILDING_SURVEYOR_PIPELINE_STAGES)[number];

export const BUILDING_SURVEYOR_PIPELINE_WON_STAGE = 'reported' as const;
export const BUILDING_SURVEYOR_PIPELINE_LOST_STAGE = 'lost' as const;

export const BUILDING_SURVEYOR_PIPELINE_LABELS: Record<
  BuildingSurveyorPipelineStage,
  string
> = {
  enquiry: 'Enquiry',
  quoted: 'Quote sent',
  accepted: 'Accepted',
  booked: 'Booked',
  surveyed: 'Surveyed',
  reported: 'Report drafted',
  lost: 'Lost',
};

/** Ben Carey flow. Follow-up call is a card flag, not a stage. */
export const BUILDING_SURVEYOR_CORE_FLOW_STAGES = [
  'enquiry',
  'quoted',
  'accepted',
  'booked',
  'surveyed',
] as const;

export function isBuildingSurveyorPipelineStage(
  stage: string | null | undefined,
): stage is BuildingSurveyorPipelineStage {
  return Boolean(
    stage &&
    BUILDING_SURVEYOR_PIPELINE_STAGES.includes(
      stage as BuildingSurveyorPipelineStage,
    ),
  );
}

export function surveyorStageOnEnquiry(): BuildingSurveyorPipelineStage {
  return 'enquiry';
}

export function surveyorStageOnQuoteSent(): BuildingSurveyorPipelineStage {
  return 'quoted';
}

export function surveyorStageOnAccepted(): BuildingSurveyorPipelineStage {
  return 'accepted';
}

/** Quote accept or signed Terms of Business can open the Accepted gate. */
export function canOpenSurveyorAcceptedGate(input: {
  quoteAccepted?: boolean;
  termsSigned?: boolean;
}): boolean {
  return Boolean(input.quoteAccepted || input.termsSigned);
}

export function publicFormPipelineStage(
  spaceType: string | null | undefined,
): string {
  return spaceType === 'building-surveyor' ? 'enquiry' : 'lead';
}

export const BUILDING_SURVEYOR_PIPELINE_BOARD_STAGES =
  BUILDING_SURVEYOR_PIPELINE_STAGES.map((key) => ({
    key,
    label: BUILDING_SURVEYOR_PIPELINE_LABELS[key],
  }));

export function isBuildingSurveyorTerminalStage(stage: string): boolean {
  return (
    stage === BUILDING_SURVEYOR_PIPELINE_WON_STAGE ||
    stage === BUILDING_SURVEYOR_PIPELINE_LOST_STAGE
  );
}

export const DEFAULT_BUILDING_SURVEYOR_BOARD_NAME = 'Pipeline';

/** User-facing board title. Legacy stored "Enquiries" maps to Pipeline. */
export function displayBuildingSurveyorBoardName(name?: string | null) {
  const trimmed = name?.trim();
  if (!trimmed || /^enquiries$/i.test(trimmed)) {
    return DEFAULT_BUILDING_SURVEYOR_BOARD_NAME;
  }
  return trimmed;
}
