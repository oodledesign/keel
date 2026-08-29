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
  quoted: 'Quoted',
  accepted: 'Accepted',
  booked: 'Booked',
  surveyed: 'Surveyed',
  reported: 'Report drafted',
  lost: 'Lost',
};

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

export const DEFAULT_BUILDING_SURVEYOR_BOARD_NAME = 'Enquiries';
