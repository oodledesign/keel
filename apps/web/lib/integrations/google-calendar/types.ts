export type GoogleCalendarConnection = {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  calendarId: string;
  plannerCalendarId: string | null;
  busyCalendarIds: string[];
  personalCalendarIds: string[];
  scopes: string | null;
};

export type GoogleCalendarListItem = {
  id: string;
  summary: string;
  primary: boolean;
  selected: boolean;
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
  /** Google Calendar ID used for updates (defaults to the user's read calendar). */
  calendar_id: string;
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

export type PlannerCalendarSyncBlock = {
  blockId: string;
  title: string;
  start: string;
  end: string;
  isCalendarEvent: boolean;
  isBreak: boolean;
  googleEventId: string | null;
  googleCalendarId: string | null;
  pushedByPlanner: boolean;
};

export type PlannerCalendarSyncMapping = {
  blockId: string;
  googleEventId: string;
  googleCalendarId: string;
  pushedByPlanner: boolean;
};

export type RecorderCalendarAttendee = {
  name: string;
  email: string;
};

export type RecorderCalendarEvent = {
  id: string;
  title: string;
  attendees: RecorderCalendarAttendee[];
  start: string;
  end: string;
};
