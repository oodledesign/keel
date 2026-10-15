/**
 * Enquiry → quote → booking stages for Building Surveyor workspaces.
 * Stored on the shared pipeline_deals.stage column.
 */
export const BUILDING_SURVEYOR_PIPELINE_STAGES = [
  'enquiry',
  'quoted',
  'accepted',
  'booked',
  'tob_sent',
  'surveyed',
  'reported',
  'invoice_sent',
  'survey_sent',
  'lost',
] as const;

export type BuildingSurveyorPipelineStage =
  (typeof BUILDING_SURVEYOR_PIPELINE_STAGES)[number];

export const BUILDING_SURVEYOR_PIPELINE_WON_STAGE = 'survey_sent' as const;
export const BUILDING_SURVEYOR_PIPELINE_LOST_STAGE = 'lost' as const;

export const BUILDING_SURVEYOR_PIPELINE_LABELS: Record<
  BuildingSurveyorPipelineStage,
  string
> = {
  enquiry: 'Inquiry',
  quoted: 'Quote sent',
  accepted: 'Accepted',
  booked: 'Booked',
  tob_sent: 'Terms of business sent',
  surveyed: 'Surveyed',
  reported: 'Report drafted',
  invoice_sent: 'Invoice sent',
  survey_sent: 'Survey sent',
  lost: 'Lost',
};

/** Bracketts flow. Follow-up call is a card flag, not a stage. */
export const BUILDING_SURVEYOR_CORE_FLOW_STAGES = [
  'enquiry',
  'quoted',
  'accepted',
  'booked',
  'tob_sent',
  'surveyed',
  'reported',
  'invoice_sent',
  'survey_sent',
] as const;

/** Stages a lead can only reach once the Terms of business are signed. */
export const SURVEYOR_STAGES_REQUIRING_TOB: readonly BuildingSurveyorPipelineStage[] =
  ['reported', 'invoice_sent', 'survey_sent'];

export const SURVEYOR_TOB_REQUIRED_MESSAGE =
  'Terms of business must be signed first';

/**
 * True when moving to `stage` is blocked because the Terms of business are not
 * signed. Only surveyor stage keys are ever blocked.
 */
export function surveyorStageBlockedByTob(
  stage: string | null | undefined,
  tobSigned: boolean,
): boolean {
  if (tobSigned || !stage) return false;
  return (SURVEYOR_STAGES_REQUIRING_TOB as readonly string[]).includes(stage);
}

/** Leads in these stages can be offered for archiving when idle. */
export const SURVEYOR_ARCHIVABLE_STAGES: readonly BuildingSurveyorPipelineStage[] =
  ['enquiry', 'quoted'];

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
