export type GoogleCalendarConnection = {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  calendarId: string;
  plannerCalendarId: string | null;
  scopes: string | null;
};

export type GoogleCalendarConnectionStatus = {
  connected: boolean;
  configured: boolean;
};

export type PlannerCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  calendar: string;
  is_all_day: boolean;
};

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export type ScheduledPlannerBlock = {
  title: string;
  start: string;
  end: string;
};

export type RecorderCalendarAttendee = {
  name: string;
  email: string;
};

export type RecorderCalendarEvent = {
  title: string;
  attendees: RecorderCalendarAttendee[];
  start: string;
  end: string;
};
