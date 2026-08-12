export type ClientProjectHealth = 'on_track' | 'at_risk' | 'behind';

export type ClientsWorkspaceVariant = 'work' | 'commercial';

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

export type ClientOverviewHighlight = {
  id: string;
  title: string;
  kind: 'disposal' | 'requirement' | 'viewing' | 'lease';
  href?: string;
  meta?: string | null;
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
  clientType: 'business' | 'individual' | null;
  commercialRole: string | null;
  projectCount: number;
  teamMemberCount: number;
  dueTaskCount: number;
  projects: ClientOverviewProject[];
  teamMembers: ClientOverviewTeamMember[];
  /** Commercial Contacts metrics */
  disposalCount: number;
  requirementCount: number;
  viewingCount: number;
  leaseCount: number;
  highlights: ClientOverviewHighlight[];
};

export type ClientRow = {
  id: string;
  display_name: string | null;
  company_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  client_type?: string | null;
  commercial_role?: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  picture_url?: string | null;
  created_at: string;
  updated_at: string;
};
