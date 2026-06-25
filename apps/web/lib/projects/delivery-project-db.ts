import { DELIVERY_PROJECT_TYPE } from './project-types';

/** Supabase table for all projects (delivery + campaign). */
export const PROJECTS_TABLE = 'projects';

export const DELIVERY_PROJECT_FILTER = {
  project_type: DELIVERY_PROJECT_TYPE,
} as const;

export const PROJECT_ASSIGNMENTS_TABLE = 'project_assignments';
export const PROJECT_DELIVERY_NOTES_TABLE = 'project_delivery_notes';
export const PROJECT_EVENTS_TABLE = 'project_events';
export const PROJECT_EVENT_ASSIGNMENTS_TABLE = 'project_event_assignments';

/**
 * Delivery primary client embed. Required after clients.project_id FK — bare `clients(...)`
 * is ambiguous (PGRST201) between projects.client_id and clients.project_id.
 */
export const PROJECT_PRIMARY_CLIENT_EMBED =
  'clients!projects_client_id_fkey(display_name)' as const;
