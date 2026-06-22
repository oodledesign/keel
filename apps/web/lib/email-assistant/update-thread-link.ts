import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getDbForWorkspaceTaskAssignmentOptions } from '~/home/_lib/server/workspace-scope';
import { syncSuggestedActionItemsFromThreadLink } from './action-item-links';

type UpdateEmailThreadLinkInput = {
  accountId: string | null;
  clientId: string | null;
  projectId: string | null;
};

async function validateProject(
  client: SupabaseClient,
  projectId: string,
  accountId: string,
) {
  const { data, error } = await client
    .from('projects')
    .select('id, account_id, client_id')
    .eq('id', projectId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.account_id !== accountId) {
    throw new Error('Project not found in this workspace');
  }

  return data as { id: string; account_id: string; client_id: string | null };
}

async function validateClient(
  client: SupabaseClient,
  clientId: string,
  accountId: string,
) {
  const { data, error } = await client
    .from('clients')
    .select('id, account_id')
    .eq('id', clientId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Client not found in this workspace');
  }
}

export async function updateEmailThreadLink(
  client: SupabaseClient,
  userId: string,
  threadId: string,
  input: UpdateEmailThreadLinkInput,
) {
  const clearing =
    !input.accountId && !input.clientId && !input.projectId;

  if (clearing) {
    const { error } = await client
      .from('email_threads')
      .update({
        account_id: null,
        client_id: null,
        project_id: null,
        link_source: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', threadId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    await syncSuggestedActionItemsFromThreadLink(client, userId, threadId, {
      accountId: null,
      clientId: null,
      projectId: null,
    });

    return;
  }

  if (!input.accountId) {
    throw new Error('Choose a workspace');
  }

  const readDb = await getDbForWorkspaceTaskAssignmentOptions(
    client,
    userId,
    input.accountId,
  );

  let clientId = input.clientId;
  let projectId = input.projectId;

  if (projectId) {
    const project = await validateProject(
      readDb,
      projectId,
      input.accountId,
    );
    clientId = clientId ?? project.client_id;
  }

  if (clientId) {
    await validateClient(readDb, clientId, input.accountId);
  } else if (!projectId) {
    throw new Error('Choose a client or project');
  }

  const { error } = await client
    .from('email_threads')
    .update({
      account_id: input.accountId,
      client_id: clientId,
      project_id: projectId,
      link_source: 'manual',
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  await syncSuggestedActionItemsFromThreadLink(client, userId, threadId, {
    accountId: input.accountId,
    clientId: clientId ?? null,
    projectId: projectId ?? null,
  });
}
