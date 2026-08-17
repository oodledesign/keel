import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import type { PersonalVisionChromeFlags } from './personal-vision-chrome.types';
import { createPersonalVisionService } from './personal-vision.service';

export type { PersonalVisionChromeFlags };

export const loadPersonalVisionChromeFlags = cache(
  async (): Promise<PersonalVisionChromeFlags> => {
    const user = await requireUserInServerComponent();
    const client = getSupabaseServerClient();
    return createPersonalVisionService(client).loadChromeFlags(user.id);
  },
);
