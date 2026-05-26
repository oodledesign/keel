export type EveningPart = {
  id: string;
  title: string;
  notes: string;
};

export type MeetupContentItem = {
  id: string;
  kind: 'richtext' | 'link' | 'youtube' | 'video';
  title: string;
  body: string | null;
  url: string | null;
  sortOrder: number;
};

export type MeetupAttendee = {
  userId: string;
  displayName: string;
  status: 'going' | 'maybe' | 'not_going';
};

export type MeetupSeriesOption = {
  id: string;
  name: string;
};

export type MeetupTemplate = {
  id: string;
  name: string;
  defaultTitle: string | null;
  mealPlan: string | null;
  eveningParts: EveningPart[];
  contentItems: Array<{
    kind: MeetupContentItem['kind'];
    title: string;
    body?: string;
    url?: string;
  }>;
};

export type MeetupListRow = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  status: string;
  seriesId: string | null;
  seriesName: string | null;
  seriesLabel: string | null;
  attendeeCount: number;
  dateLabel: string;
  timeLabel: string;
  isPast: boolean;
};

export type MeetupDetail = {
  id: string;
  accountId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  sessionNotes: string | null;
  mealPlan: string | null;
  eveningParts: EveningPart[];
  status: string;
  seriesId: string | null;
  seriesName: string | null;
  seriesLabel: string | null;
  templateId: string | null;
  contentItems: MeetupContentItem[];
  attendees: MeetupAttendee[];
  record: {
    transcript: string | null;
    aiSummary: string | null;
    reflectionNotes: string | null;
    summarizedAt: string | null;
  } | null;
};

export type MemberNoteRow = {
  id: string;
  subjectUserId: string;
  subjectName: string;
  authorUserId: string;
  authorName: string;
  visibility: 'leaders' | 'leaders_and_subject' | 'private';
  category: 'general' | 'prayer_request';
  content: string;
  createdAt: string;
  canEdit: boolean;
};

export type GroupMemberOption = {
  userId: string;
  displayName: string;
};
