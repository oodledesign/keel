/**
 * Crisis / self-harm guardrails for user-facing Ozer AI chat.
 * Conversational features only — do not run this on email bodies or meeting notes.
 */

export const SAMARITANS_PHONE = '116 123';
export const IASP_URL = 'https://www.iasp.info/suicidalthoughts/';

export const AI_CRISIS_REPLY = `I'm sorry you're going through this. I can't help with plans to harm yourself, and I'm not a crisis service.

If you are in immediate danger, call 999.

In the UK and Ireland you can talk to Samaritans any time on ${SAMARITANS_PHONE} (free), or find local support at ${IASP_URL}.

If you want help with work, planning, or your workspace after you're safe, I'm here for that.`;

export const AI_SAFETY_SYSTEM_PROMPT = `Safety: If the user expresses suicidal ideation, self-harm, or intent to harm themselves or others, do not continue the requested task, do not give instructions, and do not role-play a therapist. Respond briefly with compassion, tell them you are not a crisis service, and point them to emergency services (999 in the UK) and Samaritans 116 123 (UK/Ireland, free) plus ${IASP_URL}. Then stop.`;

const CRISIS_PATTERNS: RegExp[] = [
  /\bsuicid(e|al)\b/i,
  /\bkill(?:ing)? myself\b/i,
  /\bend my life\b/i,
  /\bwant to die\b/i,
  /\bdon't want to (?:live|be alive)\b/i,
  /\bdont want to (?:live|be alive)\b/i,
  /\bbetter off dead\b/i,
  /\bself[-\s]?harm\b/i,
  /\bcut myself\b/i,
  /\bhurt myself\b/i,
  /\bhang myself\b/i,
  /\boverdose\b/i,
];

const CONVERSATIONAL_FEATURES = new Set([
  'second_brain_query',
  'quick_action_plan',
  'planner_generate',
  'meal_plan_generate',
  'meal_recipes_generate',
]);

export function isConversationalAiFeature(feature: string): boolean {
  return CONVERSATIONAL_FEATURES.has(feature);
}

export function detectCrisisIntent(text: string | null | undefined): boolean {
  const value = text?.trim().replace(/['’]/g, "'");
  if (!value) return false;
  return CRISIS_PATTERNS.some((pattern) => pattern.test(value));
}

export function withAiSafetySystemPrompt(
  feature: string,
  systemPrompt: string,
): string {
  if (!isConversationalAiFeature(feature)) {
    return systemPrompt;
  }

  return `${systemPrompt}\n\n${AI_SAFETY_SYSTEM_PROMPT}`;
}
