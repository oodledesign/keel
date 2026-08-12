import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  EMPTY_PERSONAL_VISION_CONTENT,
  type PersonalVisionContent,
  PersonalVisionContentSchema,
  ensureGoalHorizons,
} from './personal-vision.schema';

function cleanStringList(items: string[]): string[] {
  return items.map((s) => s.trim()).filter(Boolean);
}

export function sanitizePersonalVisionContent(
  content: PersonalVisionContent,
): PersonalVisionContent {
  return PersonalVisionContentSchema.parse({
    foundations: cleanStringList(content.foundations),
    principles: cleanStringList(content.principles),
    daily_ritual: cleanStringList(content.daily_ritual),
    long_term_mindset: cleanStringList(content.long_term_mindset),
    identity_snapshot: content.identity_snapshot?.trim() ?? '',
    legacy_to_date: {
      headline: content.legacy_to_date.headline?.trim() ?? '',
      body: content.legacy_to_date.body?.trim() ?? '',
      wins: cleanStringList(content.legacy_to_date.wins),
    },
    story: {
      items: content.story.items
        .map((item) => ({
          id: item.id,
          label: item.label.trim(),
          detail: item.detail?.trim() ?? '',
        }))
        .filter((item) => item.label),
    },
    manifesto: content.manifesto?.trim() ?? '',
    character: {
      traits: cleanStringList(content.character.traits),
      style: cleanStringList(content.character.style),
      achievements: cleanStringList(content.character.achievements),
      mentors: cleanStringList(content.character.mentors),
      branding: content.character.branding?.trim() ?? '',
    },
    goals: ensureGoalHorizons(content.goals).map((goal) => ({
      ...goal,
      title: goal.title?.trim() ?? '',
      wealth_goals: goal.wealth_goals
        .map((g) => ({
          id: g.id,
          label: g.label.trim(),
          target_pence:
            typeof g.target_pence === 'number' ? g.target_pence : null,
        }))
        .filter((g) => g.label),
      other_goals: cleanStringList(goal.other_goals),
      standards: cleanStringList(goal.standards),
    })),
    affirmations: cleanStringList(content.affirmations),
  });
}

export type PersonalVisionRow = {
  content: PersonalVisionContent;
  financeAccountIds: string[];
  dashboardEnabled: boolean;
};

function parseContent(raw: unknown): PersonalVisionContent {
  const parsed = PersonalVisionContentSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return {
      ...EMPTY_PERSONAL_VISION_CONTENT,
      goals: ensureGoalHorizons([]),
    };
  }
  return {
    ...parsed.data,
    goals: ensureGoalHorizons(parsed.data.goals),
  };
}

/**
 * Untyped accessors until `pnpm supabase:web:typegen` includes
 * `personal_visions` + `user_settings.personal_vision_dashboard_enabled`.
 */
function visionDb(client: SupabaseClient) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as any;
}

export function createPersonalVisionService(client: SupabaseClient) {
  const db = visionDb(client);

  return {
    async loadForUser(userId: string): Promise<PersonalVisionRow> {
      const [{ data: vision }, { data: settings }] = await Promise.all([
        db
          .from('personal_visions')
          .select('content, finance_account_ids')
          .eq('user_id', userId)
          .maybeSingle(),
        db
          .from('user_settings')
          .select('personal_vision_dashboard_enabled')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      const visionRow = vision as {
        content?: unknown;
        finance_account_ids?: string[] | null;
      } | null;

      const settingsRow = settings as {
        personal_vision_dashboard_enabled?: boolean | null;
      } | null;

      return {
        content: parseContent(visionRow?.content),
        financeAccountIds: (visionRow?.finance_account_ids ?? []).filter(
          Boolean,
        ),
        dashboardEnabled:
          settingsRow?.personal_vision_dashboard_enabled === true,
      };
    },

    async saveForUser(
      userId: string,
      input: {
        content: PersonalVisionContent;
        financeAccountIds: string[];
        dashboardEnabled: boolean;
      },
    ) {
      const content = sanitizePersonalVisionContent(input.content);

      const { error: visionError } = await db.from('personal_visions').upsert(
        {
          user_id: userId,
          content,
          finance_account_ids: input.financeAccountIds,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (visionError) {
        throw new Error(visionError.message);
      }

      const { error: settingsError } = await db.from('user_settings').upsert(
        {
          user_id: userId,
          personal_vision_dashboard_enabled: input.dashboardEnabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (settingsError) {
        throw new Error(settingsError.message);
      }
    },

    async isDashboardEnabled(userId: string): Promise<boolean> {
      const { data } = await db
        .from('user_settings')
        .select('personal_vision_dashboard_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      return (
        (data as { personal_vision_dashboard_enabled?: boolean | null } | null)
          ?.personal_vision_dashboard_enabled === true
      );
    },
  };
}
