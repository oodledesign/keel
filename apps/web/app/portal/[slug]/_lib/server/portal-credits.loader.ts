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
    } catch (error) {
      console.error('[portal] loadPortalCanRequestService:', error);
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
    } catch (error) {
      console.error('[portal] loadPortalCreditsBundle:', error);
      return null;
    }
  },
);

export type PortalCreditsSnapshot = {
  balance: number;
  creditsPerCycle: number | null;
  nextRenewalDate: string | null;
};

/** Layout + Overview only need balance / renewal — skip history and request types. */
export const loadPortalCreditsSnapshot = cache(
  async (clientOrgId: string): Promise<PortalCreditsSnapshot | null> => {
    try {
      return await createPortalCreditsService(
        getSupabaseServerClient(),
      ).getCreditsSnapshot(clientOrgId);
    } catch (error) {
      console.error('[portal] loadPortalCreditsSnapshot:', error);
      return null;
    }
  },
);
