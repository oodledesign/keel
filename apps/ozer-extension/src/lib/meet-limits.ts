/**
 * What Google Meet actually exposes to a page script.
 *
 * Meet does not publish a speaker API. The extension reads the same DOM a
 * participant already sees. Names are available when Meet renders them on
 * tiles, the people list, captions, or an “is speaking” aria-label.
 *
 * This is not reliable in every layout:
 * - Tiles can show “You” / a truncated name / no name on a crowded grid
 * - Captions are off unless someone enables them
 * - Class names change; we prefer aria / data attributes
 * - Meet never gives a stable participant UUID we can treat as identity
 *
 * When a name is missing we send `name: null` (“Unknown speaker”). We do not
 * rename remote participants to a fused `Them` bucket.
 *
 * The extension does not tap WebRTC, tab audio, or credentials.
 */
export const MEET_SPEAKER_LIMITS = {
  requiresVisibleNames: true,
  captionsOptional: true,
  noWebrtcTap: true,
  unknownNameSentinel: null,
} as const;

export const GENERIC_SPEAKER_LABELS = new Set([
  'you',
  'them',
  'someone',
  'someone is speaking',
  'participant',
  'unknown',
  'speaker',
  'mute',
  'unmute',
  'pin',
  'more',
  'more options',
  'present now',
  'presentation',
]);

export function isGenericSpeakerLabel(value: string): boolean {
  return GENERIC_SPEAKER_LABELS.has(value.trim().toLowerCase());
}
