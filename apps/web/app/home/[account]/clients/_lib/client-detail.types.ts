export type ClientDetailOverviewSeed = {
  jobs: Array<{
    id: string;
    title: string | null;
    status: string;
    value_pence: number | null;
    created_at: string;
    updated_at: string;
  }>;
  notes: Array<{ id: string; note: string; created_at: string }>;
  meetings: Array<{
    id: string;
    title: string;
    meetingDate: string | null;
    createdAt: string;
  }>;
  bookings: Array<{
    id: string;
    startAt: string;
    eventTypeName: string;
    inviteeName: string | null;
  }>;
};
