'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  DASHBOARD_PRESET_IDS,
  type DashboardPresetId,
} from '~/config/dashboard-presets.config';
import pathsConfig from '~/config/paths.config';
import {
  type CompletedProductTours,
  parseCompletedProductTours,
} from '~/lib/product-tour/types';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

const PresetSchema = z.enum(DASHBOARD_PRESET_IDS);

function revalidateWorkspaceDashboard(slug: string) {
  const publicHome = pathsConfig.app.accountHome.replace('[account]', slug);
  revalidatePath(`/home/${slug}`, 'layout');
  revalidatePath(`/app/${slug}`, 'layout');
  revalidatePath(publicHome, 'layout');
  revalidatePath(publicHome);
  revalidatePath(pathsConfig.app.accountSettings.replace('[account]', slug));
}

export const saveDashboardPresetAction = enhanceAction(
  async (input) => {
    const user = await requireUserInServerComponent();
    const client = getSupabaseServerClient();
    const preset = PresetSchema.parse(input.presetId) as DashboardPresetId;

    const { error } = await client.from('workspace_dashboard_shortcuts').upsert(
      {
        user_id: user.id,
        account_id: input.accountId,
        dashboard_preset: preset,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,account_id' },
    );

    if (error) {
      throw new Error(error.message);
    }

    if (input.markOnboardingComplete) {
      const { data } = await client
        .from('user_settings')
        .select('completed_product_tours')
        .eq('user_id', user.id)
        .maybeSingle();

      const current = parseCompletedProductTours(data?.completed_product_tours);
      const next: CompletedProductTours = {
        ...current,
        work_dashboard_preset: new Date().toISOString(),
      };

      const { error: tourError } = await client.from('user_settings').upsert(
        {
          user_id: user.id,
          completed_product_tours: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (tourError) {
        throw new Error(tourError.message);
      }
    }

    revalidateWorkspaceDashboard(input.accountSlug);
    return { success: true as const, presetId: preset };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      presetId: PresetSchema,
      markOnboardingComplete: z.boolean().optional(),
    }),
  },
);
