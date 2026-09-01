import { resolveClientListTitle } from '~/lib/clients/resolve-client-list-display';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

import { publicHttpsImageUrl } from './workspace-shared';

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
  picture_url?: string | null;
};

export type NativeClient = {
  id: string;
  name: string;
  email: string | null;
  company_name: string | null;
  client_type: string | null;
  /** Public HTTPS company logo. Same value as `logo`. */
  image: string | null;
  logo: string | null;
};

export type NativeClientContact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
};

export type NativeClientDetail = NativeClient & {
  contacts: NativeClientContact[];
};

export function mapNativeClient(row: NativeClientRow): NativeClient {
  const image = publicHttpsImageUrl(
    toSupabasePublicStorageUrl(row.picture_url),
  );

  return {
    id: row.id,
    name: resolveClientListTitle(row),
    email: row.email?.trim() || null,
    company_name: row.company_name?.trim() || null,
    client_type: row.client_type?.trim() || null,
    image,
    logo: image,
  };
}

export function mapNativeClientContact(input: {
  id?: string | null;
  account_id?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  is_primary?: boolean | null;
  emails?: Array<{ email?: string | null; is_primary?: boolean | null }> | null;
}): NativeClientContact | null {
  if (!input.id) {
    return null;
  }

  const composed = [input.first_name, input.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  const name = composed || input.full_name?.trim() || 'Contact';

  const primaryListed = input.emails?.find((row) => row.is_primary)?.email;
  const email =
    input.email?.trim() ||
    primaryListed?.trim() ||
    input.emails?.[0]?.email?.trim() ||
    null;

  return {
    id: input.id,
    name,
    role: input.role?.trim() || null,
    email,
    phone: input.phone?.trim() || null,
    is_primary: Boolean(input.is_primary),
  };
}
