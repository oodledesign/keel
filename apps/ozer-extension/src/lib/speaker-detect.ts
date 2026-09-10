import { isGenericSpeakerLabel } from './meet-limits';
import type {
  ExtensionSpeakerConfidence,
  ExtensionSpeakerSource,
} from './protocol';

export type SpeakerObservation = {
  name: string | null;
  source: ExtensionSpeakerSource;
  confidence: ExtensionSpeakerConfidence;
  meetCode: string | null;
  selfName: string | null;
  participants: string[];
};

export type QueryRoot = Pick<ParentNode, 'querySelectorAll' | 'querySelector'>;

const MEET_CODE_RE = /\/([a-z]{3}-[a-z]{4}-[a-z]{3})(?:\/|$|\?)/i;
const SPEAKING_ARIA_RE = /^(.+?)\s+(?:is\s+)?(?:still\s+)?speaking\b/i;
const PRESENTING_ARIA_RE = /^(.+?)\s+is presenting\b/i;

function uniqueNames(names: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = sanitizeSpeakerName(raw);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export function parseMeetCode(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.hostname !== 'meet.google.com') return null;
    const match = MEET_CODE_RE.exec(url.pathname);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function sanitizeSpeakerName(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed || trimmed.length > 80) return null;
  if (isGenericSpeakerLabel(trimmed)) return null;
  if (/^\d+$/.test(trimmed)) return null;
  return trimmed;
}

function textOf(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function parseSpeakingLabel(label: string): string | null {
  const speaking = SPEAKING_ARIA_RE.exec(label.trim());
  if (speaking?.[1]) return sanitizeSpeakerName(speaking[1]);
  const presenting = PRESENTING_ARIA_RE.exec(label.trim());
  if (presenting?.[1]) return sanitizeSpeakerName(presenting[1]);
  return null;
}

function readSelfName(root: QueryRoot): string | null {
  const el = root.querySelector('[data-self-name]');
  return sanitizeSpeakerName(el?.getAttribute('data-self-name'));
}

function tileName(el: Element, selfName: string | null): string | null {
  const labelled = el.getAttribute('aria-label');
  const fromLabel = sanitizeSpeakerName(labelled?.split(',')[0] ?? labelled);
  if (fromLabel) return fromLabel === selfName ? selfName : fromLabel;

  const chunks = textOf(el)
    .split(' ')
    .join(' ')
    .split(/(?=[A-Z][a-z])/)
    .map((part) => part.trim())
    .filter(Boolean);

  const lastLine = textOf(el)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);

  return sanitizeSpeakerName(lastLine) ?? sanitizeSpeakerName(chunks[0]);
}

function collectParticipants(root: QueryRoot, selfName: string | null) {
  const nodes = [
    ...root.querySelectorAll('[data-participant-id]'),
    ...root.querySelectorAll('[data-requested-participant-id]'),
    ...root.querySelectorAll('[data-allocation-index]'),
  ];
  return uniqueNames(nodes.map((node) => tileName(node, selfName)));
}

function fromAriaSpeaking(
  root: QueryRoot,
  selfName: string | null,
): { name: string | null; source: ExtensionSpeakerSource } | null {
  const labelled = [
    ...root.querySelectorAll('[aria-label*="speaking" i]'),
    ...root.querySelectorAll('[aria-label*="presenting" i]'),
  ];

  for (const el of labelled) {
    const label = el.getAttribute('aria-label') ?? '';
    const parsed = parseSpeakingLabel(label);
    if (parsed) {
      return { name: parsed, source: 'active_speaker' };
    }
    if (/you (?:are|is) speaking/i.test(label) && selfName) {
      return { name: selfName, source: 'active_speaker' };
    }
  }

  return null;
}

function fromSpeakingFlag(
  root: QueryRoot,
  selfName: string | null,
): { name: string | null; source: ExtensionSpeakerSource } | null {
  const flagged = root.querySelector(
    '[data-is-speaking="true"], [data-speaking="true"]',
  );
  if (!flagged) return null;
  const name =
    tileName(flagged, selfName) ??
    sanitizeSpeakerName(flagged.getAttribute('data-participant-id'));
  return { name, source: 'tile' };
}

function fromCaptions(root: QueryRoot): {
  name: string | null;
  source: ExtensionSpeakerSource;
} | null {
  const regions = [
    ...root.querySelectorAll('[aria-label="Captions" i]'),
    ...root.querySelectorAll('[aria-label="Closed captions" i]'),
    ...root.querySelectorAll('[data-caption]'),
  ];
  const region = regions[0];
  if (!region) return null;

  const named = region.querySelector('[data-speaker-name], strong, b');
  const fromAttr = sanitizeSpeakerName(
    named?.getAttribute('data-speaker-name') ?? textOf(named ?? region),
  );
  if (fromAttr) {
    return { name: fromAttr, source: 'caption' };
  }

  const firstLine = textOf(region).split('\n')[0] ?? '';
  const prefix = firstLine.split(':')[0];
  const name = sanitizeSpeakerName(prefix);
  if (name && firstLine.includes(':')) {
    return { name, source: 'caption' };
  }

  return null;
}

export function observeMeetSpeakers(
  root: QueryRoot,
  href: string,
): SpeakerObservation {
  const meetCode = parseMeetCode(href);
  const selfName = readSelfName(root);
  const participants = collectParticipants(root, selfName);

  const aria = fromAriaSpeaking(root, selfName);
  if (aria) {
    return {
      ...aria,
      confidence: aria.name ? 'high' : 'low',
      meetCode,
      selfName,
      participants,
    };
  }

  const flagged = fromSpeakingFlag(root, selfName);
  if (flagged) {
    return {
      ...flagged,
      confidence: flagged.name ? 'medium' : 'low',
      meetCode,
      selfName,
      participants,
    };
  }

  const caption = fromCaptions(root);
  if (caption) {
    return {
      ...caption,
      confidence: caption.name ? 'medium' : 'low',
      meetCode,
      selfName,
      participants,
    };
  }

  return {
    name: null,
    source: 'unknown',
    confidence: 'low',
    meetCode,
    selfName,
    participants,
  };
}
