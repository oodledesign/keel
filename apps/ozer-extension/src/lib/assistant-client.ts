import {
  type ExtensionSpeakerEvent,
  OZER_ASSISTANT_DEFAULT_ORIGIN,
  OZER_ASSISTANT_HEALTH_PATH,
  OZER_ASSISTANT_SPEAKER_EVENTS_PATH,
  type OzerAssistantHealth,
} from './protocol';

export type AssistantSpeakerPayload = {
  sessionId: string;
  meetUrl?: string | null;
  meetCode?: string | null;
  events: ExtensionSpeakerEvent[];
};

export async function checkAssistantHealth(
  origin = OZER_ASSISTANT_DEFAULT_ORIGIN,
  fetchImpl: typeof fetch = fetch,
): Promise<OzerAssistantHealth | null> {
  try {
    const response = await fetchImpl(
      `${origin.replace(/\/+$/, '')}${OZER_ASSISTANT_HEALTH_PATH}`,
      { method: 'GET' },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as OzerAssistantHealth;
    if (body.ok === false) return null;
    return { ...body, ok: true };
  } catch {
    return null;
  }
}

export async function postAssistantSpeakerEvents(
  payload: AssistantSpeakerPayload,
  origin = OZER_ASSISTANT_DEFAULT_ORIGIN,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetchImpl(
      `${origin.replace(/\/+$/, '')}${OZER_ASSISTANT_SPEAKER_EVENTS_PATH}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}
