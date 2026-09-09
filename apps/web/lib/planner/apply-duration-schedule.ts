import {
  type AllocatableTask,
  type BusyInterval,
  type TaskPlacement,
  type TimeSlot,
  type UnscheduledTask,
  allocateTasksIntoSlots,
  computeFreeSlots,
  parseClockToMinutes,
} from './allocate-task-slots';
import {
  type EditablePlanBlock,
  type PlanDocument,
  type PlanSection,
  flattenPlanBlocks,
  parsePlanDocument,
  serializePlanDocument,
} from './plan-blocks';
import { isWeekPlanDocument, parseWeekdayFromHeading } from './plan-week-dates';

const DEFAULT_DAY_START = 8 * 60 + 30;
const DEFAULT_DAY_END = 17 * 60 + 30;
const MIDDAY_MINUTES = 12 * 60;

const NOT_SCHEDULED_RE = /^###\s+Not scheduled today/i;
const DEFERRED_RE = /^###\s+Deferred to next week/i;
const NOTES_RE = /^###\s+(Notes|Weekly notes)/i;

export type DurationScheduleTask = {
  id: string;
  title: string;
  estimated_duration_minutes?: number | null;
  durationMinutes?: number | null;
  project?: string | null;
};

export type DurationScheduleOptions = {
  workingHours: {
    start: string;
    end: string;
  };
};

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function baseTaskTitle(title: string): string {
  return title.replace(/\s+\(\d+\/\d+\)\s*$/, '').trim();
}

function isFixedBlock(block: EditablePlanBlock): boolean {
  return block.isCalendarEvent || block.isBreak;
}

function sectionGroupKey(heading: string): string | undefined {
  return parseWeekdayFromHeading(heading) ?? undefined;
}

function isMorningHeading(heading: string): boolean {
  return /^#{2,3}\s+Morning\b/i.test(heading.trim());
}

function isAfternoonHeading(heading: string): boolean {
  return /^#{2,3}\s+Afternoon\b/i.test(heading.trim());
}

function workingHourBounds(
  workingHours: DurationScheduleOptions['workingHours'],
) {
  return {
    dayStartMinutes:
      parseClockToMinutes(workingHours.start) ?? DEFAULT_DAY_START,
    dayEndMinutes: parseClockToMinutes(workingHours.end) ?? DEFAULT_DAY_END,
  };
}

function inferDurationFromBlocks(
  task: AllocatableTask,
  blocks: EditablePlanBlock[],
): AllocatableTask {
  if (task.durationMinutes != null && task.durationMinutes > 0) {
    return task;
  }

  const target = normalizeTitle(task.title);
  const inferred = blocks
    .filter(
      (block) =>
        !isFixedBlock(block) &&
        normalizeTitle(baseTaskTitle(block.title)) === target,
    )
    .reduce((sum, block) => sum + (block.endMinutes - block.startMinutes), 0);

  return inferred > 0 ? { ...task, durationMinutes: inferred } : task;
}

function toAllocatableTasks(tasks: DurationScheduleTask[]): AllocatableTask[] {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    durationMinutes:
      task.estimated_duration_minutes ?? task.durationMinutes ?? null,
    project: task.project,
  }));
}

function orderTasks(
  tasks: AllocatableTask[],
  blocks: EditablePlanBlock[],
): AllocatableTask[] {
  const remaining = [...tasks];
  const ordered: AllocatableTask[] = [];

  for (const block of blocks) {
    if (isFixedBlock(block)) {
      continue;
    }

    const target = normalizeTitle(baseTaskTitle(block.title));
    const index = remaining.findIndex(
      (task) => normalizeTitle(task.title) === target,
    );
    if (index < 0) {
      continue;
    }

    const [task] = remaining.splice(index, 1);
    if (task) {
      ordered.push(task);
    }
  }

  return [...ordered, ...remaining];
}

function placementToBlock(placement: TaskPlacement): EditablePlanBlock {
  const meta = [
    ...(placement.project &&
    placement.project.trim() &&
    !/^no project$/i.test(placement.project)
      ? [placement.project]
      : []),
    `~${placement.durationMinutes}min`,
  ];

  return {
    id: `sched-${placement.taskId}-${placement.partIndex}`,
    startMinutes: placement.startMinutes,
    endMinutes: placement.endMinutes,
    title: placement.title,
    meta,
    isCalendarEvent: false,
    isBreak: false,
    movable: true,
  };
}

function assignPlacementSection(
  placement: TaskPlacement,
  sections: PlanSection[],
  week: boolean,
): string {
  if (week && placement.groupKey) {
    const match = sections.find(
      (section) => sectionGroupKey(section.heading) === placement.groupKey,
    );
    if (match) {
      return match.heading;
    }
  }

  const morning = sections.find((section) => isMorningHeading(section.heading));
  const afternoon = sections.find((section) =>
    isAfternoonHeading(section.heading),
  );

  if (morning && afternoon) {
    return placement.startMinutes < MIDDAY_MINUTES
      ? morning.heading
      : afternoon.heading;
  }

  return sections[0]?.heading ?? '';
}

function splitFooter(footer: string): {
  before: string;
  notes: string;
} {
  const lines = footer.split('\n');
  const notesIdx = lines.findIndex((line) => NOTES_RE.test(line.trim()));
  if (notesIdx === -1) {
    return { before: footer.trim(), notes: '' };
  }

  return {
    before: lines.slice(0, notesIdx).join('\n').trim(),
    notes: lines.slice(notesIdx).join('\n').trim(),
  };
}

function formatUnscheduledLine(item: UnscheduledTask): string {
  const project =
    item.project && item.project.trim() && !/^no project$/i.test(item.project)
      ? ` (${item.project})`
      : '';
  return `- ${item.title}${project} — ${item.reason}`;
}

function buildScheduleFooter(
  existingFooter: string,
  unscheduled: UnscheduledTask[],
  week: boolean,
): string {
  const { notes } = splitFooter(existingFooter);
  const heading = week
    ? '### Deferred to next week'
    : '### Not scheduled today';
  const parts: string[] = [];

  if (unscheduled.length > 0) {
    parts.push([heading, ...unscheduled.map(formatUnscheduledLine)].join('\n'));
  }

  if (notes) {
    parts.push(notes);
  } else if (
    existingFooter.trim() &&
    !NOT_SCHEDULED_RE.test(existingFooter) &&
    !DEFERRED_RE.test(existingFooter)
  ) {
    const leftover = existingFooter
      .split('\n')
      .filter(
        (line) =>
          !NOT_SCHEDULED_RE.test(line.trim()) &&
          !DEFERRED_RE.test(line.trim()) &&
          !/^- /.test(line.trim()),
      )
      .join('\n')
      .trim();
    if (leftover) {
      parts.push(leftover);
    }
  }

  return parts.join('\n\n');
}

function applyDaySchedule(
  doc: PlanDocument,
  tasks: AllocatableTask[],
  options: DurationScheduleOptions,
): PlanDocument {
  const { dayStartMinutes, dayEndMinutes } = workingHourBounds(
    options.workingHours,
  );
  const blocks = flattenPlanBlocks(doc);
  const ordered = orderTasks(tasks, blocks).map((task) =>
    inferDurationFromBlocks(task, blocks),
  );
  const busy: BusyInterval[] = blocks.filter(isFixedBlock).map((block) => ({
    startMinutes: block.startMinutes,
    endMinutes: block.endMinutes,
  }));
  const slots = computeFreeSlots({
    dayStartMinutes,
    dayEndMinutes,
    busy,
  });
  const { placements, unscheduled } = allocateTasksIntoSlots(ordered, slots);

  const scheduleSections = doc.sections.filter(
    (section) =>
      !NOTES_RE.test(section.heading) &&
      !NOT_SCHEDULED_RE.test(section.heading),
  );
  const sectionHeadings =
    scheduleSections.length > 0
      ? scheduleSections.map((section) => section.heading)
      : [''];

  const blocksByHeading = new Map<string, EditablePlanBlock[]>();
  for (const heading of sectionHeadings) {
    blocksByHeading.set(heading, []);
  }

  for (const section of scheduleSections) {
    const bucket = blocksByHeading.get(section.heading) ?? [];
    for (const block of section.blocks) {
      if (isFixedBlock(block)) {
        bucket.push(block);
      }
    }
    blocksByHeading.set(section.heading, bucket);
  }

  for (const placement of placements) {
    const heading = assignPlacementSection(placement, scheduleSections, false);
    const bucket = blocksByHeading.get(heading) ?? [];
    bucket.push(placementToBlock(placement));
    blocksByHeading.set(heading, bucket);
  }

  const sections: PlanSection[] = sectionHeadings.map((heading) => ({
    heading,
    blocks: (blocksByHeading.get(heading) ?? []).sort(
      (a, b) => a.startMinutes - b.startMinutes,
    ),
  }));

  return {
    ...doc,
    sections,
    footer: buildScheduleFooter(doc.footer, unscheduled, false),
  };
}

function applyWeekSchedule(
  doc: PlanDocument,
  tasks: AllocatableTask[],
  options: DurationScheduleOptions,
): PlanDocument {
  const { dayStartMinutes, dayEndMinutes } = workingHourBounds(
    options.workingHours,
  );
  const weekdaySections = doc.sections.filter((section) =>
    Boolean(sectionGroupKey(section.heading)),
  );
  const otherSections = doc.sections.filter(
    (section) => !sectionGroupKey(section.heading),
  );

  const allBlocks = flattenPlanBlocks({
    ...doc,
    sections: weekdaySections,
  });
  const ordered = orderTasks(tasks, allBlocks).map((task) =>
    inferDurationFromBlocks(task, allBlocks),
  );

  const slots: TimeSlot[] = [];
  for (const section of weekdaySections) {
    const groupKey = sectionGroupKey(section.heading);
    const busy: BusyInterval[] = section.blocks
      .filter(isFixedBlock)
      .map((block) => ({
        startMinutes: block.startMinutes,
        endMinutes: block.endMinutes,
        groupKey,
      }));
    slots.push(
      ...computeFreeSlots({
        dayStartMinutes,
        dayEndMinutes,
        busy,
        groupKey,
      }),
    );
  }

  const { placements, unscheduled } = allocateTasksIntoSlots(ordered, slots);
  const placementsByDay = new Map<string | undefined, TaskPlacement[]>();
  for (const placement of placements) {
    const list = placementsByDay.get(placement.groupKey) ?? [];
    list.push(placement);
    placementsByDay.set(placement.groupKey, list);
  }

  const nextWeekdaySections = weekdaySections.map((section) => {
    const groupKey = sectionGroupKey(section.heading);
    const fixed = section.blocks.filter(isFixedBlock);
    const dayPlacements = (placementsByDay.get(groupKey) ?? []).map(
      placementToBlock,
    );

    return {
      ...section,
      blocks: [...fixed, ...dayPlacements].sort(
        (a, b) => a.startMinutes - b.startMinutes,
      ),
    };
  });

  return {
    ...doc,
    sections: [...nextWeekdaySections, ...otherSections],
    footer: buildScheduleFooter(doc.footer, unscheduled, true),
  };
}

export function applyDurationScheduleToDocument(
  doc: PlanDocument,
  tasks: DurationScheduleTask[],
  options: DurationScheduleOptions,
): PlanDocument {
  const allocatable = toAllocatableTasks(tasks);
  if (allocatable.length === 0) {
    return doc;
  }

  if (isWeekPlanDocument(doc)) {
    return applyWeekSchedule(doc, allocatable, options);
  }

  return applyDaySchedule(doc, allocatable, options);
}

export function applyDurationScheduleToMarkdown(
  markdown: string,
  tasks: DurationScheduleTask[],
  options: DurationScheduleOptions,
): string {
  if (!markdown.trim() || tasks.length === 0) {
    return markdown;
  }

  const doc = parsePlanDocument(markdown);
  const next = applyDurationScheduleToDocument(doc, tasks, options);
  return serializePlanDocument(next);
}
