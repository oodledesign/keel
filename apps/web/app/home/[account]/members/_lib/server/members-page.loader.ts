import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { Database } from '~/lib/database.types';

/**
 * Load data for the members page
 */
export async function loadMembersPageData(
  client: SupabaseClient<Database>,
  slug: string,
) {
  return Promise.all([
    loadAccountMembers(client, slug),
    loadInvitations(client, slug),
    canAddMember(),
    loadTeamWorkspace(slug),
  ]);
}

/**
 * Load data for the pending invites page
 */
export async function loadInvitesPageData(
  client: SupabaseClient<Database>,
  slug: string,
) {
  return Promise.all([
    loadInvitations(client, slug),
    canAddMember(),
    loadTeamWorkspace(slug),
  ]);
}

/**
 * @name canAddMember
 * @description Check if the current user can add a member to the account
 */
async function canAddMember() {
  return Promise.resolve(true);
}

/**
 * Load account members
 */
async function loadAccountMembers(
  client: SupabaseClient<Database>,
  account: string,
) {
  const { data, error } = await client.rpc('get_account_members', {
    account_slug: account,
  });

  if (error) {
    console.error(error);
    throw error;
  }

  return data ?? [];
}

/**
 * Load account invitations
 */
async function loadInvitations(
  client: SupabaseClient<Database>,
  account: string,
) {
  const { data, error } = await client.rpc('get_account_invitations', {
    account_slug: account,
  });

  if (error) {
    console.error(error);
    throw error;
  }

  return data ?? [];
}
