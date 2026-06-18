'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { disconnectGmailConnection } from '~/home/(user)/email/_lib/actions/email-assistant-actions';

function revalidateIntegrationSurfaces() {
  revalidatePath(pathsConfig.app.personalAccountSettings, 'page');
  revalidatePath(pathsConfig.app.personalPlanner, 'page');
  revalidatePath(pathsConfig.app.personalEmailAssistant, 'page');
}

export async function disconnectGoogleCalendarAction() {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { error } = await client
    .from('google_calendar_connections')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidateIntegrationSurfaces();
  return { success: true as const, error: null };
}

export async function disconnectGmailFromIntegrationsAction() {
  const result = await disconnectGmailConnection();

  if (result.success) {
    revalidateIntegrationSurfaces();
  }

  return result;
}
