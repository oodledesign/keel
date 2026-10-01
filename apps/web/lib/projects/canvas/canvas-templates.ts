import { PENDING_CANVAS_TIMESTAMP } from './canvas-layout';
import type {
  CanvasColorKey,
  CanvasItem,
  CanvasItemData,
  CanvasSectionPreset,
} from './canvas-types';

type TemplateArea = { title: string; color: CanvasColorKey; prompt: string };

type TemplateBase = {
  preset: CanvasSectionPreset;
  title: string;
  description: string;
};

/** A grid of titled sub-sections, each with a prompt sticky. */
export type CanvasAreasTemplate = TemplateBase & {
  layout: 'areas';
  areas: TemplateArea[];
};

/** Channel rows across week columns. */
export type CanvasCalendarTemplate = TemplateBase & {
  layout: 'calendar';
  weeks: number;
  channels: TemplateArea[];
};

/** A row of big figure cards over a grid of titled areas. */
export type CanvasFiguresTemplate = TemplateBase & {
  layout: 'figures';
  figures: Array<{ title: string; color: CanvasColorKey }>;
  areas: TemplateArea[];
};

export type CanvasSectionTemplate =
  | CanvasAreasTemplate
  | CanvasCalendarTemplate
  | CanvasFiguresTemplate;

export const MARKETING_TEMPLATE: CanvasAreasTemplate = {
  layout: 'areas',
  preset: 'marketing',
  title: 'Marketing',
  description: 'Goals, audience, messages, channels, assets, timeline, budget',
  areas: [
    {
      title: 'Goals & KPIs',
      color: 'green',
      prompt: 'What does success look like? Enquiries, viewings, leads, sales…',
    },
    {
      title: 'Audience',
      color: 'blue',
      prompt: 'Who are we trying to reach? Buyers, tenants, investors, locals…',
    },
    {
      title: 'Key messages',
      color: 'purple',
      prompt: 'The three things everyone should remember.',
    },
    {
      title: 'Channels',
      color: 'orange',
      prompt: 'Portals, LinkedIn, email, print, boards, events, PR…',
    },
    {
      title: 'Content & assets',
      color: 'pink',
      prompt: 'Drop photos, brochures, floorplans and copy in here.',
    },
    {
      title: 'Timeline',
      color: 'yellow',
      prompt: 'Launch date, milestones and when each channel goes live.',
    },
    {
      title: 'Budget',
      color: 'slate',
      prompt: 'Spend by channel and who signs it off.',
    },
    {
      title: 'Results',
      color: 'coral',
      prompt: 'What happened, what worked, what to change next time.',
    },
  ],
};

export const PROJECT_BRIEF_TEMPLATE: CanvasAreasTemplate = {
  layout: 'areas',
  preset: 'brief',
  title: 'Project brief',
  description: 'Background, objectives, scope, audience, deliverables, risks',
  areas: [
    {
      title: 'Background',
      color: 'slate',
      prompt: 'Why this project, why now? What has happened so far?',
    },
    {
      title: 'Objectives',
      color: 'green',
      prompt: 'What must this project achieve for the client?',
    },
    {
      title: 'Scope',
      color: 'blue',
      prompt: 'What is included — work, sites, systems, phases.',
    },
    {
      title: 'Out of scope',
      color: 'coral',
      prompt: 'What we are explicitly not doing.',
    },
    {
      title: 'Audience & stakeholders',
      color: 'purple',
      prompt: 'Who it is for, who signs off, who needs to be kept informed.',
    },
    {
      title: 'Deliverables',
      color: 'orange',
      prompt: 'The things we hand over, and when.',
    },
    {
      title: 'Success measures',
      color: 'yellow',
      prompt: 'How we will know it worked — numbers where possible.',
    },
    {
      title: 'Risks & constraints',
      color: 'pink',
      prompt: 'Budget, deadlines, dependencies, unknowns.',
    },
  ],
};

export const CONTENT_CALENDAR_TEMPLATE: CanvasCalendarTemplate = {
  layout: 'calendar',
  preset: 'content_calendar',
  title: 'Content calendar',
  description: 'Four weeks of content by channel, starting next Monday',
  weeks: 4,
  channels: [
    {
      title: 'Website & blog',
      color: 'blue',
      prompt: 'e.g. Launch article, case study, landing page',
    },
    {
      title: 'Social',
      color: 'pink',
      prompt: 'e.g. Teaser carousel, behind-the-scenes video',
    },
    {
      title: 'Email',
      color: 'purple',
      prompt: 'e.g. Launch announcement to the mailing list',
    },
    {
      title: 'Paid & PR',
      color: 'orange',
      prompt: 'e.g. Press release, boosted post, portal feature',
    },
    {
      title: 'Events & print',
      color: 'green',
      prompt: 'e.g. Open day, brochure, site board',
    },
  ],
};

export const GOALS_TARGETS_TEMPLATE: CanvasFiguresTemplate = {
  layout: 'figures',
  preset: 'targets',
  title: 'Goals & targets',
  description: 'Big current figures with targets, plus goals and what to watch',
  figures: [
    { title: 'Headline figure', color: 'green' },
    { title: 'Second figure', color: 'blue' },
    { title: 'Third figure', color: 'purple' },
    { title: 'Fourth figure', color: 'orange' },
  ],
  areas: [
    {
      title: 'Goals',
      color: 'green',
      prompt: 'What are we here to achieve? Add as many as you need.',
    },
    {
      title: 'Targets & deadlines',
      color: 'blue',
      prompt: 'The numbers and dates we are working towards.',
    },
    {
      title: 'What is working',
      color: 'yellow',
      prompt: 'Wins, momentum and things to do more of.',
    },
    {
      title: 'Needs attention',
      color: 'coral',
      prompt: 'Behind target, blocked, or at risk.',
    },
  ],
};

export const CANVAS_SECTION_TEMPLATES: CanvasSectionTemplate[] = [
  PROJECT_BRIEF_TEMPLATE,
  GOALS_TARGETS_TEMPLATE,
  MARKETING_TEMPLATE,
  CONTENT_CALENDAR_TEMPLATE,
];

const COLUMNS = 4;
const AREA = { w: 300, h: 260 };
const GAP = 24;
const PAD = 32;
const HEADER = 56;
const AREA_HEADER = 48;
const STICKY_INSET = 20;
const FIGURE_H = 190;

const CAL = {
  colW: 220,
  colGap: 16,
  rowPad: 16,
  rowH: 180,
  rowGap: 16,
  weekHeader: 40,
  rowHeader: 44,
  stickyH: 110,
};

function calendarRowWidth(weeks: number) {
  return CAL.rowPad * 2 + weeks * CAL.colW + (weeks - 1) * CAL.colGap;
}

export function sectionTemplateSize(template: CanvasSectionTemplate) {
  if (template.layout === 'figures') {
    return {
      w: PAD * 2 + COLUMNS * AREA.w + (COLUMNS - 1) * GAP,
      h: HEADER + FIGURE_H + GAP + AREA.h + PAD,
    };
  }
  if (template.layout === 'calendar') {
    const rows = template.channels.length;
    return {
      w: PAD * 2 + calendarRowWidth(template.weeks),
      h:
        HEADER +
        CAL.weekHeader +
        rows * CAL.rowH +
        (rows - 1) * CAL.rowGap +
        PAD,
    };
  }
  const rows = Math.ceil(template.areas.length / COLUMNS);
  return {
    w: PAD * 2 + COLUMNS * AREA.w + (COLUMNS - 1) * GAP,
    h: HEADER + rows * AREA.h + (rows - 1) * GAP + PAD,
  };
}

/** Monday of the week after `from` (local time). */
export function nextMonday(from: Date) {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const day = date.getDay();
  date.setDate(date.getDate() + ((8 - day) % 7 || 7));
  return date;
}

export function weekLabel(start: Date) {
  return `w/c ${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

/** A titled section laid out from a template, ready to commit. */
export function buildSectionTemplate(
  template: CanvasSectionTemplate,
  origin: { x: number; y: number },
  zIndex: { container: number; item: number },
  createId: () => string,
  now: Date = new Date(),
): CanvasItem[] {
  const size = sectionTemplateSize(template);
  const item = (
    kind: CanvasItem['kind'],
    box: { x: number; y: number; w: number; h: number },
    data: CanvasItemData,
    z: number,
  ): CanvasItem => ({
    id: createId(),
    kind,
    refId: null,
    x: Math.round(box.x),
    y: Math.round(box.y),
    w: box.w,
    h: box.h,
    zIndex: z,
    data,
    updatedAt: PENDING_CANVAS_TIMESTAMP,
    updatedBy: null,
  });

  const out: CanvasItem[] = [
    item(
      'frame',
      { ...origin, ...size },
      {
        title: template.title,
        color: 'slate',
        preset: template.preset,
        fontSize: 24,
      },
      zIndex.container,
    ),
  ];

  if (template.layout === 'calendar') {
    const start = nextMonday(now);
    const columnX = (index: number) =>
      origin.x + PAD + CAL.rowPad + index * (CAL.colW + CAL.colGap);
    for (let week = 0; week < template.weeks; week += 1) {
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() + week * 7);
      out.push(
        item(
          'text',
          { x: columnX(week), y: origin.y + HEADER, w: CAL.colW, h: 28 },
          { text: weekLabel(weekStart), fontSize: 14, bold: true },
          zIndex.item + week,
        ),
      );
    }
    template.channels.forEach((channel, index) => {
      const y =
        origin.y + HEADER + CAL.weekHeader + index * (CAL.rowH + CAL.rowGap);
      out.push(
        item(
          'frame',
          {
            x: origin.x + PAD,
            y,
            w: calendarRowWidth(template.weeks),
            h: CAL.rowH,
          },
          { title: channel.title, color: channel.color, fontSize: 14 },
          zIndex.container + 1,
        ),
        item(
          'sticky',
          { x: columnX(0), y: y + CAL.rowHeader, w: CAL.colW, h: CAL.stickyH },
          { text: channel.prompt, color: channel.color, fontSize: 12 },
          zIndex.item + template.weeks + index,
        ),
      );
    });
    return out;
  }

  if (template.layout === 'figures') {
    template.figures.forEach((figure, index) => {
      out.push(
        item(
          'metric',
          {
            x: origin.x + PAD + index * (AREA.w + GAP),
            y: origin.y + HEADER,
            w: AREA.w,
            h: FIGURE_H,
          },
          { title: figure.title, color: figure.color },
          zIndex.item + index,
        ),
      );
    });
  }
  const areaTop =
    origin.y + HEADER + (template.layout === 'figures' ? FIGURE_H + GAP : 0);

  template.areas.forEach((area, index) => {
    const x = origin.x + PAD + (index % COLUMNS) * (AREA.w + GAP);
    const y = areaTop + Math.floor(index / COLUMNS) * (AREA.h + GAP);
    out.push(
      item(
        'frame',
        { x, y, ...AREA },
        { title: area.title, color: area.color },
        zIndex.container + 1,
      ),
      item(
        'sticky',
        {
          x: x + STICKY_INSET,
          y: y + AREA_HEADER,
          w: AREA.w - STICKY_INSET * 2,
          h: 120,
        },
        { text: area.prompt, color: area.color },
        zIndex.item + COLUMNS + index,
      ),
    );
  });
  return out;
}

/** Where AI-filled stickies go inside a calendar row, per week column. */
export const CALENDAR_CELL = {
  w: CAL.colW,
  h: CAL.stickyH,
  rowHeader: CAL.rowHeader,
};
