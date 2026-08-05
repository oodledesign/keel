import {
  PROJECT_BOARD_TEMPLATE,
  PROJECT_BOARD_TEMPLATE_NAME,
} from '~/lib/projects/project-board-phase-template';
import {
  WEBSITE_DESIGN_TEMPLATE,
  WEBSITE_DESIGN_TEMPLATE_NAME,
} from '~/lib/websites/website-design-template';

/** Built-in templates seeded/ensured per workspace. Protected from overwrite. */
export const BUILTIN_PHASE_TEMPLATE_NAMES = [
  'Standard delivery',
  WEBSITE_DESIGN_TEMPLATE_NAME,
  PROJECT_BOARD_TEMPLATE_NAME,
] as const;

export type BuiltinPhaseTemplateName =
  (typeof BUILTIN_PHASE_TEMPLATE_NAMES)[number];

export function isBuiltinPhaseTemplateName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return BUILTIN_PHASE_TEMPLATE_NAMES.some(
    (item) => item.toLowerCase() === normalized,
  );
}

/** User-facing picker copy keyed by template name. */
export const PHASE_TEMPLATE_PICKER_COPY: Record<
  string,
  { blurb: string; bestFor: string }
> = {
  'Standard delivery': {
    blurb:
      'A classic delivery waterfall from discovery through launch and ongoing care.',
    bestFor:
      'Client projects with clear stages — research, design, build, ship, then support.',
  },
  [WEBSITE_DESIGN_TEMPLATE_NAME]: {
    blurb:
      'Site Studio workflow with phase pages for brief, sitemap, wireframes, design, SEO, export, and build.',
    bestFor: 'Website builds that use Site Studio planning and AI assist.',
  },
  [PROJECT_BOARD_TEMPLATE_NAME]: {
    blurb:
      'Kanban-style columns so one project works like a task board instead of a delivery waterfall.',
    bestFor:
      'Ongoing work, sprints, and boards where phases are status columns (backlog → done).',
  },
};

export function getPhaseTemplatePickerCopy(name: string): {
  blurb: string;
  bestFor: string | null;
} {
  const meta = PHASE_TEMPLATE_PICKER_COPY[name];
  if (meta) return meta;
  return { blurb: '', bestFor: null };
}

export {
  PROJECT_BOARD_TEMPLATE,
  PROJECT_BOARD_TEMPLATE_NAME,
  WEBSITE_DESIGN_TEMPLATE,
  WEBSITE_DESIGN_TEMPLATE_NAME,
};
