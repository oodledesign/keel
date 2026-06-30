import type { SupabaseClient } from '@supabase/supabase-js';

export type ResolvedFinanceLinks = {
  client_id: string | null;
  project_id: string | null;
};

export async function resolveFinanceTransactionLinks(
  client: SupabaseClient,
  accountId: string,
  input: {
    clientId?: string | null;
    projectId?: string | null;
  },
): Promise<ResolvedFinanceLinks> {
  let clientId = input.clientId?.trim() || null;
  let projectId = input.projectId?.trim() || null;

  if (projectId) {
    const { data: project, error } = await client
      .from('projects')
      .select('client_id, account_id')
      .eq('id', projectId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'Could not load project');
    }
    if (!project) {
      throw new Error('Project not found');
    }

    const projectClientId = (project.client_id as string | null) ?? null;
    if (projectClientId) {
      if (clientId && clientId !== projectClientId) {
        throw new Error('Project does not belong to the selected client');
      }
      clientId = projectClientId;
    }
  }

  if (clientId) {
    const { data: crmClient, error } = await client
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'Could not load client');
    }
    if (!crmClient) {
      throw new Error('Client not found');
    }
  }

  if (projectId && clientId) {
    const { data: project } = await client
      .from('projects')
      .select('client_id')
      .eq('id', projectId)
      .eq('account_id', accountId)
      .maybeSingle();

    const projectClientId = (project?.client_id as string | null) ?? null;
    if (projectClientId && projectClientId !== clientId) {
      projectId = null;
    }
  }

  return {
    client_id: clientId,
    project_id: projectId,
  };
}

export function projectDisplayName(project: {
  title?: string | null;
  name?: string | null;
}): string {
  return project.title?.trim() || project.name?.trim() || 'Untitled project';
}
