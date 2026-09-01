import { resolveClientListTitle } from '~/lib/clients/resolve-client-list-display';

/** Profiles that show Clients on web (and on the iPhone menu). Community has no Clients nav. */
export const NATIVE_CLIENT_WORKSPACE_PROFILES = [
  'work_design',
  'commercial_property',
  'building_surveyor',
] as const;

export type NativeClientWorkspaceProfile =
  (typeof NATIVE_CLIENT_WORKSPACE_PROFILES)[number];

export function workspaceShowsNativeClients(
  profile: string | null | undefined,
) {
  return (NATIVE_CLIENT_WORKSPACE_PROFILES as readonly string[]).includes(
    profile ?? '',
  );
}

export type NativeClientRow = {
  id: string;
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  client_type?: string | null;
  email?: string | null;
};

export type NativeClient = {
  id: string;
  name: string;
  email: string | null;
  company_name: string | null;
  client_type: string | null;
};

export function mapNativeClient(row: NativeClientRow): NativeClient {
  return {
    id: row.id,
    name: resolveClientListTitle(row),
    email: row.email?.trim() || null,
    company_name: row.company_name?.trim() || null,
    client_type: row.client_type?.trim() || null,
  };
}
