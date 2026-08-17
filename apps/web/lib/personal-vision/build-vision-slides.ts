import type {
  PersonalVisionContent,
  VisionGoalHorizon,
  VisionWealthGoalCadence,
} from './personal-vision.schema';
import { VISION_GOAL_HORIZON_LABELS } from './personal-vision.schema';

export type VisionFinanceMonthPoint = {
  monthKey: string;
  monthLabel: string;
  incomePence: number;
  isCurrent: boolean;
};

export type VisionFinanceActuals = {
  incomePence: number;
  hasFinanceData: boolean;
  workspaceNames: string[];
  monthlyIncome: VisionFinanceMonthPoint[];
  averageIncomePence: number;
};

export type VisionWealthGoalSlide = {
  label: string;
  targetPence: number | null;
  dueDate: string | null;
  cadence: VisionWealthGoalCadence;
  monthlyTargetPence: number | null;
  months: number | null;
};

type SectionMeta = {
  /** Stable section id for markers (e.g. foundations). */
  sectionKey?: string;
  /** 1-based part within the section when content spills. */
  sectionPart?: number;
  sectionParts?: number;
};

export type VisionSlide = (
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
      wealthGoals: VisionWealthGoalSlide[];
      otherGoals: string[];
      standards: string[];
      financeActuals: VisionFinanceActuals | null;
    }
  | {
      kind: 'finance';
      title: string;
      financeActuals: VisionFinanceActuals;
    }
  | { kind: 'affirmations'; title: string; items: string[] }
) &
  SectionMeta;

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

function mapWealthGoals(
  goals: PersonalVisionContent['goals'][number]['wealth_goals'],
): VisionWealthGoalSlide[] {
  return goals
    .filter((g) => g.label.trim())
    .map((g) => ({
      label: g.label.trim(),
      targetPence: typeof g.target_pence === 'number' ? g.target_pence : null,
      dueDate: g.due_date?.trim() || null,
      cadence: g.cadence === 'monthly' ? 'monthly' : 'one_off',
      monthlyTargetPence:
        typeof g.monthly_target_pence === 'number'
          ? g.monthly_target_pence
          : null,
      months: typeof g.months === 'number' ? g.months : null,
    }));
}

/** Approx items that fit a phone viewport without scrolling. */
const LIST_CHUNK = 4;
const AFFIRMATION_CHUNK = 3;
const STORY_CHUNK = 3;
const PROSE_CHARS = 420;
const WEALTH_CHUNK = 2;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (!items.length) return [[]];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function chunkProse(body: string, maxChars: number): string[] {
  const trimmed = body.trim();
  if (trimmed.length <= maxChars) return [trimmed];

  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const para of paragraphs.length ? paragraphs : [trimmed]) {
    if (!current) {
      if (para.length <= maxChars) {
        current = para;
      } else {
        for (let i = 0; i < para.length; i += maxChars) {
          chunks.push(para.slice(i, i + maxChars).trim());
        }
      }
      continue;
    }
    if (`${current}\n\n${para}`.length <= maxChars) {
      current = `${current}\n\n${para}`;
    } else {
      pushCurrent();
      if (para.length <= maxChars) {
        current = para;
      } else {
        for (let i = 0; i < para.length; i += maxChars) {
          chunks.push(para.slice(i, i + maxChars).trim());
        }
      }
    }
  }
  pushCurrent();
  return chunks.length ? chunks : [trimmed];
}

function withSectionParts<T extends VisionSlide>(
  sectionKey: string,
  slides: T[],
): T[] {
  if (slides.length <= 1) {
    return slides.map((slide) => ({
      ...slide,
      sectionKey,
      sectionPart: 1,
      sectionParts: 1,
    }));
  }
  return slides.map((slide, i) => ({
    ...slide,
    sectionKey,
    sectionPart: i + 1,
    sectionParts: slides.length,
  }));
}

function pushListSection(
  slides: VisionSlide[],
  sectionKey: string,
  title: string,
  items: string[],
) {
  if (!items.length) return;
  const chunks = chunkArray(items, LIST_CHUNK);
  slides.push(
    ...withSectionParts(
      sectionKey,
      chunks.map((chunk) => ({
        kind: 'list' as const,
        title,
        items: chunk,
      })),
    ),
  );
}

/**
 * Build the Personal Vision slideshow deck.
 * Long sections spill onto continuation slides with sectionPart markers.
 */
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

  pushListSection(
    slides,
    'foundations',
    'Foundations',
    nonEmptyStrings(content.foundations),
  );
  pushListSection(
    slides,
    'principles',
    'Principles',
    nonEmptyStrings(content.principles),
  );
  pushListSection(
    slides,
    'daily_ritual',
    'Daily ritual',
    nonEmptyStrings(content.daily_ritual),
  );
  pushListSection(
    slides,
    'long_term_mindset',
    'Long-term mindset',
    nonEmptyStrings(content.long_term_mindset),
  );

  if (content.identity_snapshot?.trim()) {
    const parts = chunkProse(content.identity_snapshot.trim(), PROSE_CHARS);
    slides.push(
      ...withSectionParts(
        'identity',
        parts.map((body) => ({
          kind: 'prose' as const,
          title: 'Identity',
          body,
        })),
      ),
    );
  }

  if (hasLegacy(content)) {
    const wins = nonEmptyStrings(content.legacy_to_date.wins);
    const winChunks = wins.length ? chunkArray(wins, LIST_CHUNK) : [[]];
    const legacySlides: VisionSlide[] = winChunks.map((chunk, i) => ({
      kind: 'legacy' as const,
      title: 'Legacy to date',
      headline:
        i === 0
          ? content.legacy_to_date.headline?.trim() || undefined
          : undefined,
      body:
        i === 0 ? content.legacy_to_date.body?.trim() || undefined : undefined,
      wins: chunk,
    }));
    slides.push(...withSectionParts('legacy', legacySlides));
  }

  const storyItems = content.story.items.filter((i) => i.label.trim());
  if (storyItems.length) {
    const mapped = storyItems.map((i) => ({
      label: i.label.trim(),
      detail: i.detail?.trim() || undefined,
    }));
    slides.push(
      ...withSectionParts(
        'story',
        chunkArray(mapped, STORY_CHUNK).map((items) => ({
          kind: 'story' as const,
          title: 'Story',
          items,
        })),
      ),
    );
  }

  if (content.manifesto?.trim()) {
    const parts = chunkProse(content.manifesto.trim(), PROSE_CHARS);
    slides.push(
      ...withSectionParts(
        'manifesto',
        parts.map((body) => ({
          kind: 'prose' as const,
          title: 'Manifesto',
          body,
        })),
      ),
    );
  }

  if (hasCharacter(content)) {
    const c = content.character;
    const characterSlides: VisionSlide[] = [];
    const traits = nonEmptyStrings(c.traits);
    const style = nonEmptyStrings(c.style);
    const achievements = nonEmptyStrings(c.achievements);
    const mentors = nonEmptyStrings(c.mentors);
    const branding = c.branding?.trim() || undefined;

    // Prefer one subsection per slide so mobile never scrolls.
    if (traits.length) {
      for (const chunk of chunkArray(traits, LIST_CHUNK)) {
        characterSlides.push({
          kind: 'character',
          title: 'Character & brand',
          traits: chunk,
          style: [],
          achievements: [],
          mentors: [],
        });
      }
    }
    if (style.length) {
      for (const chunk of chunkArray(style, LIST_CHUNK)) {
        characterSlides.push({
          kind: 'character',
          title: 'Character & brand',
          traits: [],
          style: chunk,
          achievements: [],
          mentors: [],
        });
      }
    }
    if (achievements.length) {
      for (const chunk of chunkArray(achievements, LIST_CHUNK)) {
        characterSlides.push({
          kind: 'character',
          title: 'Character & brand',
          traits: [],
          style: [],
          achievements: chunk,
          mentors: [],
        });
      }
    }
    if (mentors.length) {
      for (const chunk of chunkArray(mentors, LIST_CHUNK)) {
        characterSlides.push({
          kind: 'character',
          title: 'Character & brand',
          traits: [],
          style: [],
          achievements: [],
          mentors: chunk,
        });
      }
    }
    if (branding) {
      for (const body of chunkProse(branding, PROSE_CHARS)) {
        characterSlides.push({
          kind: 'character',
          title: 'Character & brand',
          traits: [],
          style: [],
          achievements: [],
          mentors: [],
          branding: body,
        });
      }
    }

    slides.push(...withSectionParts('character', characterSlides));
  }

  let financeAttached = false;
  for (const block of content.goals) {
    if (!hasGoalsBlock(block)) continue;
    const wealthGoals = mapWealthGoals(block.wealth_goals);
    const otherGoals = nonEmptyStrings(block.other_goals);
    const standards = nonEmptyStrings(block.standards);
    const hasWealthGoals = wealthGoals.length > 0;
    const attachFinance = Boolean(financeActuals) && hasWealthGoals;
    if (attachFinance) financeAttached = true;

    const title =
      block.title?.trim() ||
      `Goals · ${VISION_GOAL_HORIZON_LABELS[block.horizon]}`;
    const horizonLabel = VISION_GOAL_HORIZON_LABELS[block.horizon];
    const sectionKey = `goals_${block.horizon}`;
    const goalSlides: VisionSlide[] = [];
    let financePlaced = false;

    if (wealthGoals.length) {
      chunkArray(wealthGoals, WEALTH_CHUNK).forEach((wealthChunk, wi) => {
        goalSlides.push({
          kind: 'goals',
          title,
          horizon: block.horizon,
          horizonLabel,
          wealthGoals: wealthChunk,
          otherGoals: [],
          standards: [],
          financeActuals:
            wi === 0 && attachFinance && !financePlaced ? financeActuals : null,
        });
        if (wi === 0 && attachFinance) financePlaced = true;
      });
    }

    if (otherGoals.length) {
      chunkArray(otherGoals, LIST_CHUNK).forEach((chunk, oi) => {
        goalSlides.push({
          kind: 'goals',
          title,
          horizon: block.horizon,
          horizonLabel,
          wealthGoals: [],
          otherGoals: chunk,
          standards: [],
          financeActuals:
            oi === 0 && attachFinance && !financePlaced ? financeActuals : null,
        });
        if (oi === 0 && attachFinance) financePlaced = true;
      });
    }

    if (standards.length) {
      for (const chunk of chunkArray(standards, LIST_CHUNK)) {
        goalSlides.push({
          kind: 'goals',
          title,
          horizon: block.horizon,
          horizonLabel,
          wealthGoals: [],
          otherGoals: [],
          standards: chunk,
          financeActuals: null,
        });
      }
    }

    if (!goalSlides.length) {
      goalSlides.push({
        kind: 'goals',
        title,
        horizon: block.horizon,
        horizonLabel,
        wealthGoals: [],
        otherGoals: [],
        standards: [],
        financeActuals: attachFinance ? financeActuals : null,
      });
    }

    slides.push(...withSectionParts(sectionKey, goalSlides));
  }

  if (financeActuals && !financeAttached) {
    slides.push({
      kind: 'finance',
      title: 'Finances',
      financeActuals,
      sectionKey: 'finance',
      sectionPart: 1,
      sectionParts: 1,
    });
  }

  const affirmations = nonEmptyStrings(content.affirmations);
  if (affirmations.length) {
    slides.push(
      ...withSectionParts(
        'affirmations',
        chunkArray(affirmations, AFFIRMATION_CHUNK).map((items) => ({
          kind: 'affirmations' as const,
          title: 'Affirmations',
          items,
        })),
      ),
    );
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
