import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadUserTeamMemberships } from '~/home/_lib/server/user-team-memberships.loader';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  type VisionSlide,
  buildVisionSlides,
  visionHasPlayableContent,
} from './build-vision-slides';
import type { PersonalVisionContent } from './personal-vision.schema';
import { createPersonalVisionService } from './personal-vision.service';
import { loadVisionFinanceActuals } from './vision-finance';

export type PersonalVisionDeck = {
  slides: VisionSlide[];
  hasContent: boolean;
  content: PersonalVisionContent;
  financeAccountIds: string[];
  dashboardEnabled: boolean;
  displayName: string | null;
};

export const loadPersonalVisionDeck = cache(
  async (): Promise<PersonalVisionDeck> => {
    const user = await requireUserInServerComponent();
    const client = getSupabaseServerClient();
    const service = createPersonalVisionService(client);
    const [row, memberships] = await Promise.all([
      service.loadForUser(user.id),
      loadUserTeamMemberships(user.id, client),
    ]);

    const nameMap = new Map(
      memberships.map((m) => [m.id, m.name?.trim() || m.slug || 'Workspace']),
    );

    const allowedFinanceIds = row.financeAccountIds.filter((id) =>
      nameMap.has(id),
    );

    const financeActuals = await loadVisionFinanceActuals(
      client,
      allowedFinanceIds,
      nameMap,
    ).catch(() => null);

    const meta = user.user_metadata as
      | { first_name?: string; full_name?: string; name?: string }
      | undefined;
    const displayName =
      (typeof meta?.first_name === 'string' && meta.first_name.trim()) ||
      (typeof meta?.full_name === 'string' && meta.full_name.trim()) ||
      (typeof meta?.name === 'string' && meta.name.trim()) ||
      user.email?.split('@')[0] ||
      null;

    const slides = buildVisionSlides({
      content: row.content,
      displayName,
      financeActuals,
    });

    return {
      slides,
      hasContent: visionHasPlayableContent(row.content),
      content: row.content,
      financeAccountIds: allowedFinanceIds,
      dashboardEnabled: row.dashboardEnabled,
      displayName,
    };
  },
);

export const loadPersonalVisionDashboardEnabled = cache(
  async (): Promise<boolean> => {
    const user = await requireUserInServerComponent();
    const client = getSupabaseServerClient();
    return createPersonalVisionService(client).isDashboardEnabled(user.id);
  },
);
