import { describe, expect, it } from 'vitest';

import {
  detectCrisisIntent,
  isConversationalAiFeature,
  withAiSafetySystemPrompt,
} from './safety';

describe('detectCrisisIntent', () => {
  it('detects explicit self-harm phrasing', () => {
    expect(detectCrisisIntent('I want to kill myself')).toBe(true);
    expect(detectCrisisIntent('I don’t want to live anymore')).toBe(true);
    expect(detectCrisisIntent('thinking about suicide')).toBe(true);
  });

  it('does not match ordinary workspace text', () => {
    expect(detectCrisisIntent('kill the background process')).toBe(false);
    expect(detectCrisisIntent('plan dinner for the family')).toBe(false);
    expect(detectCrisisIntent('')).toBe(false);
  });
});

describe('conversational safety prompt', () => {
  it('appends only on chat-like features', () => {
    expect(isConversationalAiFeature('second_brain_query')).toBe(true);
    expect(isConversationalAiFeature('support_docs_chat')).toBe(true);
    expect(isConversationalAiFeature('email_draft')).toBe(false);
    expect(withAiSafetySystemPrompt('email_draft', 'Draft emails.')).toBe(
      'Draft emails.',
    );
    expect(
      withAiSafetySystemPrompt('quick_action_plan', 'You are Quick Action.'),
    ).toContain('Samaritans');
  });
});
