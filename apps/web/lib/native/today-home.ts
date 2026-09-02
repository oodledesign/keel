import type { NativeFinances } from './invoices-shared';
import { type NativeNote, isNativeMeetingNote } from './notes-shared';
import type { NativeTask } from './task-map';

export type NativeTodayCompatItem = {
  id: string;
  title: string;
  subtitle: string | null;
};

export type NativeTodayMeeting = {
  id: string;
  title: string;
  created_at: string;
};

export type NativeTodayHomePayload = {
  greeting: string;
  date: string;
  date_label: string;
  message: string | null;
  tasks_due_today: NativeTask[];
  overdue_tasks: NativeTask[];
  recent_notes: NativeNote[];
  meetings_today: NativeTodayMeeting[];
  finances: NativeFinances | null;
  /** Flat merge of due-today then overdue for older clients. */
  items: NativeTodayCompatItem[];
};

export function nativeTodayDateParts(now: Date = new Date()) {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  const dateLabel = now.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return { date, date_label: dateLabel };
}

export function splitNativeTodayTasks(
  tasks: NativeTask[],
  today: string,
): { dueToday: NativeTask[]; overdue: NativeTask[] } {
  const dueToday: NativeTask[] = [];
  const overdue: NativeTask[] = [];

  for (const task of tasks) {
    const due = task.due?.trim() || '';
    if (!due) {
      continue;
    }
    if (due === today) {
      dueToday.push(task);
    } else if (due < today) {
      overdue.push(task);
    }
  }

  return { dueToday, overdue };
}

export function nativeTodayTaskSubtitle(task: NativeTask) {
  const parts = [task.due, task.client_name?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function mergeNativeTodayItems(
  dueToday: NativeTask[],
  overdue: NativeTask[],
): NativeTodayCompatItem[] {
  const seen = new Set<string>();
  const items: NativeTodayCompatItem[] = [];

  for (const task of [...dueToday, ...overdue]) {
    if (!seen.add(task.id)) {
      continue;
    }
    items.push({
      id: task.id,
      title: task.title,
      subtitle: nativeTodayTaskSubtitle(task),
    });
  }

  return items;
}

export function pickNativeTodayNotes(
  notes: NativeNote[],
  today: string,
  limit = 5,
): { recentNotes: NativeNote[]; meetingsToday: NativeTodayMeeting[] } {
  const meetingsToday: NativeTodayMeeting[] = [];
  const recentNotes: NativeNote[] = [];

  for (const note of notes) {
    if (isNativeMeetingNote(note)) {
      const created = note.created_at.slice(0, 10);
      if (created === today && meetingsToday.length < limit) {
        meetingsToday.push({
          id: note.id,
          title: note.title.trim() || 'Meeting',
          created_at: note.created_at,
        });
      }
      continue;
    }

    if (recentNotes.length < limit) {
      recentNotes.push(note);
    }
  }

  return { recentNotes, meetingsToday };
}

export function nativeTodaySupportingMessage(input: {
  dueTodayCount: number;
  overdueCount: number;
}) {
  const parts: string[] = [];
  if (input.dueTodayCount > 0) {
    parts.push(
      input.dueTodayCount === 1
        ? '1 due today'
        : `${input.dueTodayCount} due today`,
    );
  }
  if (input.overdueCount > 0) {
    parts.push(
      input.overdueCount === 1 ? '1 overdue' : `${input.overdueCount} overdue`,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function buildNativeTodayHomePayload(input: {
  greeting: string;
  date: string;
  dateLabel: string;
  dueToday: NativeTask[];
  overdue: NativeTask[];
  recentNotes: NativeNote[];
  meetingsToday: NativeTodayMeeting[];
  finances: NativeFinances | null;
}): NativeTodayHomePayload {
  return {
    greeting: input.greeting,
    date: input.date,
    date_label: input.dateLabel,
    message: nativeTodaySupportingMessage({
      dueTodayCount: input.dueToday.length,
      overdueCount: input.overdue.length,
    }),
    tasks_due_today: input.dueToday,
    overdue_tasks: input.overdue,
    recent_notes: input.recentNotes,
    meetings_today: input.meetingsToday,
    finances: input.finances,
    items: mergeNativeTodayItems(input.dueToday, input.overdue),
  };
}
