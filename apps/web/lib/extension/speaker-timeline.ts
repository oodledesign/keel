import type { ExtensionSpeakerEvent } from '~/lib/extension/protocol';

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(11, 19);
}

export function formatSpeakerTimeline(events: ExtensionSpeakerEvent[]): string {
  if (events.length === 0) return '';

  const lines = events.map((event) => {
    const start = formatClock(event.startedAt);
    const end = event.endedAt ? formatClock(event.endedAt) : '…';
    const name = event.name?.trim() || 'Unknown speaker';
    return `- ${start}–${end} ${name} (${event.source}, ${event.confidence})`;
  });

  return `## Speakers (Google Meet)\n${lines.join('\n')}`;
}

export function appendSpeakerTimeline(
  content: string,
  events: ExtensionSpeakerEvent[],
): string {
  const timeline = formatSpeakerTimeline(events);
  if (!timeline) return content.trim();
  const body = content.trim();
  return body ? `${body}\n\n${timeline}` : timeline;
}
