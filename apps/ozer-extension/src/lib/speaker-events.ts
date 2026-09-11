import type {
  ExtensionSpeakerConfidence,
  ExtensionSpeakerEvent,
  ExtensionSpeakerSource,
} from './protocol';

export type OpenSpeakerTurn = {
  name: string | null;
  startedAt: string;
  source: ExtensionSpeakerSource;
  confidence: ExtensionSpeakerConfidence;
};

const SAME_SPEAKER_GAP_MS = 800;

function speakerKey(name: string | null): string {
  return name?.trim().toLowerCase() || '__unknown__';
}

export function shouldContinueTurn(
  current: OpenSpeakerTurn,
  nextName: string | null,
  nextAt: string,
): boolean {
  if (speakerKey(current.name) !== speakerKey(nextName)) return false;
  const gap = Date.parse(nextAt) - Date.parse(current.startedAt);
  return Number.isFinite(gap) && gap >= 0;
}

export function closeTurn(
  current: OpenSpeakerTurn,
  endedAt: string,
): ExtensionSpeakerEvent {
  return {
    name: current.name,
    startedAt: current.startedAt,
    endedAt,
    source: current.source,
    confidence: current.confidence,
  };
}

export class SpeakerTurnTracker {
  private current: OpenSpeakerTurn | null = null;
  private lastSeenAt: string | null = null;

  observe(
    observation: {
      name: string | null;
      source: ExtensionSpeakerSource;
      confidence: ExtensionSpeakerConfidence;
    },
    at: string,
  ): ExtensionSpeakerEvent | null {
    this.lastSeenAt = at;
    if (!this.current) {
      this.current = {
        name: observation.name,
        startedAt: at,
        source: observation.source,
        confidence: observation.confidence,
      };
      return null;
    }

    if (shouldContinueTurn(this.current, observation.name, at)) {
      if (
        !this.current.name &&
        observation.name &&
        observation.confidence !== 'low'
      ) {
        this.current.name = observation.name;
        this.current.source = observation.source;
        this.current.confidence = observation.confidence;
      }
      return null;
    }

    const closed = closeTurn(this.current, at);
    this.current = {
      name: observation.name,
      startedAt: at,
      source: observation.source,
      confidence: observation.confidence,
    };
    return closed;
  }

  flush(at?: string): ExtensionSpeakerEvent | null {
    if (!this.current) return null;
    const endedAt = at ?? this.lastSeenAt ?? this.current.startedAt;
    const closed = closeTurn(this.current, endedAt);
    this.current = null;
    return closed;
  }
}

export function minTurnDurationMs(): number {
  return SAME_SPEAKER_GAP_MS;
}
