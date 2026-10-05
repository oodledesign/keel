import type { CanvasItem } from '~/lib/projects/canvas/canvas-types';

import type { CanvasLookups } from './canvas-context';

export const CANVAS_KIND_LABELS: Record<CanvasItem['kind'], string> = {
  phase: 'Phase',
  task: 'Task',
  member: 'Team member',
  client: 'Client',
  note: 'Note',
  contact: 'Contact',
  doc: 'File',
  sticky: 'Sticky',
  text: 'Text',
  shape: 'Shape',
  frame: 'Section',
  image: 'Image',
  link: 'Link',
  draw: 'Drawing',
  connector: 'Arrow',
  timeline: 'Timeline',
  metric: 'Figure',
  roadmap: 'Roadmap',
};

function firstLine(value: string | undefined) {
  return (value ?? '').trim().split('\n')[0]?.slice(0, 120) ?? '';
}

function hostname(url: string | undefined) {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** A readable title plus body text for any canvas item. */
export function canvasItemText(
  item: CanvasItem,
  lookups: CanvasLookups,
): { label: string; detail: string } {
  const id = item.refId ?? '';
  switch (item.kind) {
    case 'phase': {
      const phase = lookups.phasesById.get(id);
      return {
        label: phase?.name ?? 'Phase',
        detail: [phase?.status, phase?.description].filter(Boolean).join(' '),
      };
    }
    case 'task': {
      const task = lookups.tasksById.get(id);
      return {
        label: task?.title ?? 'Task',
        detail: [task?.status, task?.notes].filter(Boolean).join(' '),
      };
    }
    case 'member': {
      const person = lookups.teamById.get(id);
      return {
        label: person?.name || person?.email || 'Team member',
        detail: [person?.role, person?.description, person?.email]
          .filter(Boolean)
          .join(' '),
      };
    }
    case 'client': {
      const client = lookups.client;
      return {
        label: client?.displayName || client?.companyName || 'Client',
        detail: [client?.companyName, client?.email].filter(Boolean).join(' '),
      };
    }
    case 'note': {
      const note = lookups.notesById.get(id);
      return {
        label: note?.title || 'Untitled note',
        detail: note?.content ?? '',
      };
    }
    case 'contact': {
      const contact = lookups.contactsById.get(id);
      return {
        label: contact?.name || contact?.email || 'Contact',
        detail: [
          contact?.role,
          contact?.companyName,
          contact?.description,
          contact?.email,
        ]
          .filter(Boolean)
          .join(' '),
      };
    }
    case 'doc': {
      const doc = lookups.docsById.get(id);
      return {
        label: doc?.title ?? 'File',
        detail: [doc?.docType, doc?.mimeType].filter(Boolean).join(' '),
      };
    }
    case 'sticky':
    case 'text':
    case 'shape':
      return {
        label: firstLine(item.data.text) || CANVAS_KIND_LABELS[item.kind],
        detail: item.data.text ?? '',
      };
    case 'frame':
      return { label: item.data.title?.trim() || 'Section', detail: '' };
    case 'image':
      return {
        label: item.data.title || hostname(item.data.url) || 'Image',
        detail: item.data.url ?? '',
      };
    case 'link':
      return {
        label: item.data.title || hostname(item.data.url) || 'Link',
        detail: [item.data.description, item.data.url]
          .filter(Boolean)
          .join(' '),
      };
    case 'metric':
      return {
        label: item.data.title?.trim() || 'Figure',
        detail: [item.data.value, item.data.goal, item.data.text]
          .filter(Boolean)
          .join(' '),
      };
    case 'connector':
      return { label: item.data.label || 'Arrow', detail: '' };
    default:
      return { label: CANVAS_KIND_LABELS[item.kind], detail: '' };
  }
}
