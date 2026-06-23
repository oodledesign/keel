export type ClientProjectHealth = 'on_track' | 'at_risk' | 'behind';

export type ClientOverviewProject = {
  id: string;
  title: string;
  progress: number;
  health: ClientProjectHealth;
};

export type ClientOverviewTeamMember = {
  userId: string;
  name: string | null;
  pictureUrl: string | null;
};

export type ClientOverviewItem = {
  id: string;
  displayName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  pictureUrl: string | null;
  tagline: string;
  updatedAt: string;
  projectCount: number;
  teamMemberCount: number;
  dueTaskCount: number;
  projects: ClientOverviewProject[];
  teamMembers: ClientOverviewTeamMember[];
};

export type ClientRow = {
  id: string;
  display_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  picture_url?: string | null;
  created_at: string;
  updated_at: string;
};
