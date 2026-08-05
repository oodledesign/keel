import type { PhaseTemplatePhase } from '~/home/[account]/jobs/_lib/schema/project-phases.schema';

export const PROJECT_BOARD_TEMPLATE_NAME = 'Project board';

/**
 * Kanban-style delivery phases so a project behaves like an individual
 * task board (backlog → ship) rather than a linear delivery waterfall.
 */
export const PROJECT_BOARD_TEMPLATE: {
  name: string;
  description: string;
  phases: PhaseTemplatePhase[];
} = {
  name: PROJECT_BOARD_TEMPLATE_NAME,
  description:
    'Backlog → Up Next → In Progress → Client Review → Revisions → Approved → Done',
  phases: [
    {
      name: 'Backlog / Not Started',
      colour: '#64748B',
      description: 'Captured but not committed to a sprint or timeline.',
      is_milestone: false,
    },
    {
      name: 'Up Next / Planned',
      colour: '#3B82F6',
      description: 'Scoped, scheduled, and ready to start.',
      is_milestone: false,
    },
    {
      name: 'In Progress',
      colour: '#FF5C34',
      description: 'Actively being worked.',
      is_milestone: false,
    },
    {
      name: 'Client Review / Waiting on Feedback',
      colour: '#8B5CF6',
      description: "Ball is in the client's court.",
      is_milestone: false,
    },
    {
      name: 'Revisions',
      colour: '#EC4899',
      description: 'Rework after feedback — separate from first-pass In Progress.',
      is_milestone: false,
    },
    {
      name: 'Approved / Ready to Ship',
      colour: '#14B8A6',
      description: 'Signed off and ready to deliver or launch.',
      is_milestone: true,
    },
    {
      name: 'Done / Delivered',
      colour: '#22C55E',
      description: 'Shipped and complete.',
      is_milestone: true,
    },
  ],
};
