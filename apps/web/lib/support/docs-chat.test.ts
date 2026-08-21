import { describe, expect, it } from 'vitest';

import { AI_CRISIS_REPLY } from '~/lib/ai/safety';

import { answerSupportDocsQuestion } from './docs-chat';

describe('answerSupportDocsQuestion', () => {
  it('short-circuits crisis intents without calling the model', async () => {
    const result = await answerSupportDocsQuestion({
      message: 'I want to kill myself',
    });

    expect(result.crisis).toBe(true);
    expect(result.sources).toEqual([]);
    expect(result.answer).toBe(AI_CRISIS_REPLY);
  });
});
