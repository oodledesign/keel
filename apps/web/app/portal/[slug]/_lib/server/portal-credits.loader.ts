import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { PortalCreditsBundle } from '../types/portal-credits.types';
import { createPortalCreditsService } from './portal-credits.service';

export const loadPortalCanRequestService = cache(
  async (clientOrgId: string): Promise<boolean> => {
    try {
      const rows = await createPortalCreditsService(
        getSupabaseServerClient(),
      ).listEffectiveServices(clientOrgId);
      return rows.length > 0;
    } catch {
      return false;
    }
  },
);

export const loadPortalCreditsBundle = cache(
  async (clientOrgId: string): Promise<PortalCreditsBundle | null> => {
    try {
      return await createPortalCreditsService(
        getSupabaseServerClient(),
      ).getCreditsBundle(clientOrgId);
    } catch {
      return null;
    }
  },
);
