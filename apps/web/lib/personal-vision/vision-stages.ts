export type VisionStageId =
  | 'foundations'
  | 'principles'
  | 'daily_ritual'
  | 'long_term_mindset'
  | 'identity_snapshot'
  | 'legacy_to_date'
  | 'story'
  | 'manifesto'
  | 'character'
  | 'goals'
  | 'affirmations';

export type VisionStageMeta = {
  id: VisionStageId;
  title: string;
  description: string;
};

/** Explanatory copy for the settings editor — not slideshow titles. */
export const VISION_STAGES: VisionStageMeta[] = [
  {
    id: 'foundations',
    title: 'Foundations',
    description:
      'Core beliefs that frame why this practice matters — the ideas you return to before everything else.',
  },
  {
    id: 'principles',
    title: 'Principles',
    description:
      'Guiding principles you choose to live by. Keep them short enough to read aloud.',
  },
  {
    id: 'daily_ritual',
    title: 'Daily ritual',
    description:
      'The morning and evening steps of this practice — how you move through the Vision each day.',
  },
  {
    id: 'long_term_mindset',
    title: 'Long-term mindset',
    description:
      'Reminders about compound thinking and long horizons — why today’s work serves a future you cannot see yet.',
  },
  {
    id: 'identity_snapshot',
    title: 'Identity snapshot',
    description:
      'A short line for who you are becoming — the identity you are growing into.',
  },
  {
    id: 'legacy_to_date',
    title: 'Legacy to date',
    description:
      'Your wins and trophy cabinet so far — proof that you are already building something real.',
  },
  {
    id: 'story',
    title: 'Story',
    description:
      'Your journey as a timeline: past chapters, where you are now, and the milestones still ahead.',
  },
  {
    id: 'manifesto',
    title: 'Manifesto',
    description:
      'Write the future in present tense — a vivid picture of the life you are building as if it is already true.',
  },
  {
    id: 'character',
    title: 'Character & brand',
    description:
      'Traits, style, achievements to pursue, mentors you learn from, and how you want to be known.',
  },
  {
    id: 'goals',
    title: 'Goals by horizon',
    description:
      'Concrete goals at 1 month, 6 months, 12 months, 5 years, and 20 years. Wealth goals can show live finance income from the workspaces you select.',
  },
  {
    id: 'affirmations',
    title: 'Affirmations',
    description:
      'Lines you speak aloud daily to reinforce the beliefs and identity you are choosing.',
  },
];
