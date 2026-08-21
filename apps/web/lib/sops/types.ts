import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export type {
  SopPlaybookRow,
  SopPlaybookStepRow,
  SopRecurrence,
  SopRunRow,
  SopRunStepRow,
  SopTeamMember,
} from './shared';
export {
  SOP_ADDING_A_DISPOSAL_TITLE,
  defaultPeriodLabel,
  defaultRunTitle,
  listingIdFromPathname,
  resolveSopTargetRoute,
  sopRunListingId,
} from './shared';

export function getSopsDb(client?: SupabaseClient) {
  return supabaseCustomSchema(client ?? getSupabaseServerClient(), 'sops');
}
