import type {
  PersonalVisionContent,
  VisionGoalHorizon,
} from './personal-vision.schema';
import { VISION_GOAL_HORIZON_LABELS } from './personal-vision.schema';

export type VisionFinanceActuals = {
  incomePence: number;
  hasFinanceData: boolean;
  workspaceNames: string[];
};

export type VisionSlide =
  | { kind: 'cover'; title: string; subtitle?: string }
  | { kind: 'list'; title: string; items: string[] }
  | { kind: 'prose'; title: string; body: string }
  | {
      kind: 'legacy';
      title: string;
      headline?: string;
      body?: string;
      wins: string[];
    }
  | {
      kind: 'story';
      title: string;
      items: { label: string; detail?: string }[];
    }
  | {
      kind: 'character';
      title: string;
      traits: string[];
      style: string[];
      achievements: string[];
      mentors: string[];
      branding?: string;
    }
  | {
      kind: 'goals';
      title: string;
      horizon: VisionGoalHorizon;
      horizonLabel: string;
      wealthGoals: { label: string; targetPence: number | null }[];
      otherGoals: string[];
      standards: string[];
      financeActuals: VisionFinanceActuals | null;
    }
  | { kind: 'affirmations'; title: string; items: string[] };

function nonEmptyStrings(items: string[]): string[] {
  return items.map((s) => s.trim()).filter(Boolean);
}

function hasLegacy(content: PersonalVisionContent): boolean {
  const legacy = content.legacy_to_date;
  return Boolean(
    legacy.headline?.trim() ||
    legacy.body?.trim() ||
    nonEmptyStrings(legacy.wins).length,
  );
}

function hasCharacter(content: PersonalVisionContent): boolean {
  const c = content.character;
  return Boolean(
    nonEmptyStrings(c.traits).length ||
    nonEmptyStrings(c.style).length ||
    nonEmptyStrings(c.achievements).length ||
    nonEmptyStrings(c.mentors).length ||
    c.branding?.trim(),
  );
}

function hasGoalsBlock(block: PersonalVisionContent['goals'][number]): boolean {
  return Boolean(
    block.title?.trim() ||
    block.wealth_goals.some((g) => g.label.trim()) ||
    nonEmptyStrings(block.other_goals).length ||
    nonEmptyStrings(block.standards).length,
  );
}

export function buildVisionSlides(input: {
  content: PersonalVisionContent;
  displayName?: string | null;
  financeActuals: VisionFinanceActuals | null;
}): VisionSlide[] {
  const { content, displayName, financeActuals } = input;
  const slides: VisionSlide[] = [];

  const name = displayName?.trim() || 'Your';
  slides.push({
    kind: 'cover',
    title: `${name} Vision`,
    subtitle: 'Read aloud. Feel it. Then go do the work.',
  });

  const foundations = nonEmptyStrings(content.foundations);
  if (foundations.length) {
    slides.push({ kind: 'list', title: 'Foundations', items: foundations });
  }

  const principles = nonEmptyStrings(content.principles);
  if (principles.length) {
    slides.push({ kind: 'list', title: 'Principles', items: principles });
  }

  const ritual = nonEmptyStrings(content.daily_ritual);
  if (ritual.length) {
    slides.push({ kind: 'list', title: 'Daily ritual', items: ritual });
  }

  const longTerm = nonEmptyStrings(content.long_term_mindset);
  if (longTerm.length) {
    slides.push({
      kind: 'list',
      title: 'Long-term mindset',
      items: longTerm,
    });
  }

  if (content.identity_snapshot?.trim()) {
    slides.push({
      kind: 'prose',
      title: 'Identity',
      body: content.identity_snapshot.trim(),
    });
  }

  if (hasLegacy(content)) {
    slides.push({
      kind: 'legacy',
      title: 'Legacy to date',
      headline: content.legacy_to_date.headline?.trim() || undefined,
      body: content.legacy_to_date.body?.trim() || undefined,
      wins: nonEmptyStrings(content.legacy_to_date.wins),
    });
  }

  const storyItems = content.story.items.filter((i) => i.label.trim());
  if (storyItems.length) {
    slides.push({
      kind: 'story',
      title: 'Story',
      items: storyItems.map((i) => ({
        label: i.label.trim(),
        detail: i.detail?.trim() || undefined,
      })),
    });
  }

  if (content.manifesto?.trim()) {
    slides.push({
      kind: 'prose',
      title: 'Manifesto',
      body: content.manifesto.trim(),
    });
  }

  if (hasCharacter(content)) {
    slides.push({
      kind: 'character',
      title: 'Character & brand',
      traits: nonEmptyStrings(content.character.traits),
      style: nonEmptyStrings(content.character.style),
      achievements: nonEmptyStrings(content.character.achievements),
      mentors: nonEmptyStrings(content.character.mentors),
      branding: content.character.branding?.trim() || undefined,
    });
  }

  for (const block of content.goals) {
    if (!hasGoalsBlock(block)) continue;
    slides.push({
      kind: 'goals',
      title:
        block.title?.trim() ||
        `Goals · ${VISION_GOAL_HORIZON_LABELS[block.horizon]}`,
      horizon: block.horizon,
      horizonLabel: VISION_GOAL_HORIZON_LABELS[block.horizon],
      wealthGoals: block.wealth_goals
        .filter((g) => g.label.trim())
        .map((g) => ({
          label: g.label.trim(),
          targetPence:
            typeof g.target_pence === 'number' ? g.target_pence : null,
        })),
      otherGoals: nonEmptyStrings(block.other_goals),
      standards: nonEmptyStrings(block.standards),
      financeActuals:
        block.wealth_goals.some((g) => g.label.trim()) && financeActuals
          ? financeActuals
          : null,
    });
  }

  const affirmations = nonEmptyStrings(content.affirmations);
  if (affirmations.length) {
    slides.push({
      kind: 'affirmations',
      title: 'Affirmations',
      items: affirmations,
    });
  }

  return slides;
}

export function visionHasPlayableContent(
  content: PersonalVisionContent,
): boolean {
  const slides = buildVisionSlides({
    content,
    financeActuals: null,
  });
  // Cover alone is not enough
  return slides.length > 1;
}
