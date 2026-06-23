export type TranscriptSegment = {
  speaker: string;
  text: string;
};

const SPEAKER_LINE_RE = /^([^:]+):\s*(.*)$/;

export function parseTranscriptContent(content: string): {
  segments: TranscriptSegment[];
  hasSpeakerLabels: boolean;
} {
  const trimmed = content.trim();
  if (!trimmed) {
    return { segments: [], hasSpeakerLabels: false };
  }

  const segments: TranscriptSegment[] = [];
  let hasSpeakerLabels = false;
  const lines = trimmed.split(/\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const match = trimmedLine.match(SPEAKER_LINE_RE);
    if (match) {
      const speaker = match[1]?.trim() ?? '';
      if (!speaker) continue;
      hasSpeakerLabels = true;
      segments.push({
        speaker,
        text: (match[2] ?? '').trim(),
      });
      continue;
    }

    const last = segments[segments.length - 1];
    if (last) {
      last.text = last.text ? `${last.text}\n${trimmedLine}` : trimmedLine;
    } else {
      segments.push({ speaker: 'Unknown', text: trimmedLine });
    }
  }

  return { segments, hasSpeakerLabels };
}

export function serializeTranscriptSegments(
  segments: TranscriptSegment[],
): string {
  return segments
    .map((segment) => {
      const text = segment.text.trim();
      return text ? `${segment.speaker}: ${text}` : `${segment.speaker}:`;
    })
    .join('\n\n')
    .trim();
}

export function distinctTranscriptSpeakers(
  segments: TranscriptSegment[],
): string[] {
  const seen = new Set<string>();
  const order: string[] = [];

  for (const segment of segments) {
    if (seen.has(segment.speaker)) continue;
    seen.add(segment.speaker);
    order.push(segment.speaker);
  }

  return order;
}

export function renameSpeakersInSegments(
  segments: TranscriptSegment[],
  renames: Record<string, string>,
): TranscriptSegment[] {
  return segments.map((segment) => {
    const next = renames[segment.speaker]?.trim();
    return next ? { ...segment, speaker: next } : segment;
  });
}

export function normalizeTranscriptSegments(
  value: unknown,
): TranscriptSegment[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const segments: TranscriptSegment[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const speaker = (item as { speaker?: unknown }).speaker;
    const text = (item as { text?: unknown }).text;
    if (typeof speaker !== 'string' || !speaker.trim()) continue;
    segments.push({
      speaker: speaker.trim(),
      text: typeof text === 'string' ? text : '',
    });
  }

  return segments.length > 0 ? segments : null;
}

export function resolveTranscriptSegments(input: {
  content: string;
  speakerSegments?: unknown;
}): TranscriptSegment[] {
  const stored = normalizeTranscriptSegments(input.speakerSegments);
  if (stored) return stored;

  const { segments, hasSpeakerLabels } = parseTranscriptContent(input.content);
  if (!hasSpeakerLabels) return [];
  return segments;
}

export function collectSpeakerNameSuggestions(input: {
  calendarAttendees?: Array<{ name?: string | null; email?: string | null }>;
  clientName?: string | null;
  clients?: Array<{ name: string }>;
}): string[] {
  const suggestions = new Set<string>();

  if (input.clientName?.trim()) {
    suggestions.add(input.clientName.trim());
  }

  for (const client of input.clients ?? []) {
    if (client.name?.trim()) {
      suggestions.add(client.name.trim());
    }
  }

  for (const attendee of input.calendarAttendees ?? []) {
    if (attendee.name?.trim()) {
      suggestions.add(attendee.name.trim());
    }
    if (attendee.email?.trim()) {
      const local = attendee.email.split('@')[0]?.trim();
      if (local) suggestions.add(local);
    }
  }

  return [...suggestions].sort((a, b) => a.localeCompare(b));
}
