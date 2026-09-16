export type NativeSurveyorHomeSurvey = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  client_name: string | null;
};

export type NativeSurveyorHomeDeal = {
  id: string;
  title: string;
  stage: string;
  stage_label: string;
  client_name: string | null;
};

export type NativeSurveyorHome = {
  open_count: number;
  enquiry_count: number;
  booked_count: number;
  surveyed_count: number;
  recent_surveys: NativeSurveyorHomeSurvey[];
  pipeline: NativeSurveyorHomeDeal[];
};

export function emptyNativeSurveyorHome(): NativeSurveyorHome {
  return {
    open_count: 0,
    enquiry_count: 0,
    booked_count: 0,
    surveyed_count: 0,
    recent_surveys: [],
    pipeline: [],
  };
}
