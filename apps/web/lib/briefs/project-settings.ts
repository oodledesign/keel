import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export type ProjectBriefSettings = {
  brief_brand_name: string | null;
  brief_voice_notes: string | null;
  brief_mention_rules: string | null;
  brief_research_depth: 'standard' | 'deep';
};

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

export async function loadProjectBriefSettings(
  projectId: string,
): Promise<ProjectBriefSettings> {
  const { data, error } = await ranklyAdmin()
    .from('projects')
    .select(
      'brief_brand_name, brief_voice_notes, brief_mention_rules, brief_research_depth',
    )
    .eq('id', projectId)
    .maybeSingle();

  if (error || !data) {
    return {
      brief_brand_name: null,
      brief_voice_notes: null,
      brief_mention_rules: null,
      brief_research_depth: 'standard',
    };
  }

  return {
    brief_brand_name: (data.brief_brand_name as string | null) ?? null,
    brief_voice_notes: (data.brief_voice_notes as string | null) ?? null,
    brief_mention_rules: (data.brief_mention_rules as string | null) ?? null,
    brief_research_depth:
      data.brief_research_depth === 'deep' ? 'deep' : 'standard',
  };
}
