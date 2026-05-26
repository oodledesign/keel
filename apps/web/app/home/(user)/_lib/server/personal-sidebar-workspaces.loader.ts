import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadUserWorkspaceAccounts } from '~/home/_lib/server/workspace-scope';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import type { PersonalNavWorkspace } from '~/config/personal-account-navigation.config';

export const loadPersonalSidebarWorkspaces = cache(
  async (): Promise<PersonalNavWorkspace[]> => {
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();
    const rows = await loadUserWorkspaceAccounts(client, user.id);

    return rows
      .filter((w) => w.slug)
      .map((w) => ({
        id: w.id,
        label: w.name?.trim() || w.slug!,
        slug: w.slug!,
        pictureUrl: w.picture_url ?? null,
        spaceType: w.space_type,
      }));
  },
);
