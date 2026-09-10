import {
  type ExtensionSpeakerEvent,
  OZER_ASSISTANT_DEFAULT_ORIGIN,
  OZER_ASSISTANT_HEALTH_PATH,
  OZER_ASSISTANT_LEGACY_ORIGIN,
  OZER_ASSISTANT_LEGACY_SPEAKER_EVENTS_PATH,
  OZER_ASSISTANT_SPEAKER_STAMPS_PATH,
  type OzerAssistantHealth,
} from './protocol';

export type AssistantSpeakerPayload = {
  sessionId: string;
  meetUrl?: string | null;
  meetCode?: string | null;
  events: ExtensionSpeakerEvent[];
};

export type AssistantSpeakerStamp = {
  name: string | null;
  startedAt: string;
  endedAt: string | null;
};

export type AssistantSpeakerStampsBody =
  | AssistantSpeakerStamp
  | { events: AssistantSpeakerStamp[] };

function trimOrigin(origin: string) {
  return origin.replace(/\/+$/, '');
}

export function toAssistantSpeakerStamps(
  events: ExtensionSpeakerEvent[],
): AssistantSpeakerStampsBody | null {
  const stamps = events.map((event) => ({
    name: event.name,
    startedAt: event.startedAt,
    endedAt: event.endedAt,
  }));
  if (stamps.length === 0) return null;
  if (stamps.length === 1) {
    return stamps[0] ?? null;
  }
  return { events: stamps };
}

function speakerPostTargets(origin: string) {
  const primary = trimOrigin(origin || OZER_ASSISTANT_DEFAULT_ORIGIN);
  const legacy = trimOrigin(OZER_ASSISTANT_LEGACY_ORIGIN);
  const targets = [`${primary}${OZER_ASSISTANT_SPEAKER_STAMPS_PATH}`];
  if (primary !== legacy) {
    targets.push(`${legacy}${OZER_ASSISTANT_SPEAKER_STAMPS_PATH}`);
  }
  targets.push(`${legacy}${OZER_ASSISTANT_LEGACY_SPEAKER_EVENTS_PATH}`);
  return [...new Set(targets)];
}

function healthTargets(origin: string) {
  const primary = trimOrigin(origin || OZER_ASSISTANT_DEFAULT_ORIGIN);
  const targets = [`${primary}${OZER_ASSISTANT_HEALTH_PATH}`];
  const legacy = `${trimOrigin(OZER_ASSISTANT_LEGACY_ORIGIN)}${OZER_ASSISTANT_HEALTH_PATH}`;
  if (!targets.includes(legacy)) {
    targets.push(legacy);
  }
  return targets;
}

async function postJson(
  url: string,
  body: unknown,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function checkAssistantHealth(
  origin = OZER_ASSISTANT_DEFAULT_ORIGIN,
  fetchImpl: typeof fetch = fetch,
): Promise<OzerAssistantHealth | null> {
  for (const url of healthTargets(origin)) {
    try {
      const response = await fetchImpl(url, { method: 'GET' });
      if (!response.ok) continue;
      const body = (await response.json()) as OzerAssistantHealth;
      if (body.ok === false) continue;
      return { ...body, ok: true };
    } catch {
      // try the next alias
    }
  }
  return null;
}

export async function postAssistantSpeakerEvents(
  payload: AssistantSpeakerPayload,
  origin = OZER_ASSISTANT_DEFAULT_ORIGIN,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const stamps = toAssistantSpeakerStamps(payload.events);
  if (!stamps) return false;

  const targets = speakerPostTargets(origin);
  for (const url of targets) {
    const body = url.endsWith(OZER_ASSISTANT_SPEAKER_STAMPS_PATH)
      ? stamps
      : payload;
    if (await postJson(url, body, fetchImpl)) {
      return true;
    }
  }
  return false;
}
