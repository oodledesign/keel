import { describe, expect, it } from 'vitest';

import {
  AI_PROVIDER_UNAVAILABLE_MESSAGE,
  formatUserFacingAiError,
  isAiProviderQuotaOrBillingError,
} from './format-ai-provider-error';

describe('formatUserFacingAiError', () => {
  it('maps Google Gemini quota errors with docs URLs to a support message', () => {
    const error = new Error(
      'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits.',
    );

    expect(isAiProviderQuotaOrBillingError(error)).toBe(true);
    expect(formatUserFacingAiError(error)).toBe(
      AI_PROVIDER_UNAVAILABLE_MESSAGE,
    );
  });

  it('maps RESOURCE_EXHAUSTED / 429 style failures', () => {
    const error = Object.assign(new Error('RESOURCE_EXHAUSTED'), {
      status: 429,
    });

    expect(formatUserFacingAiError(error)).toBe(
      AI_PROVIDER_UNAVAILABLE_MESSAGE,
    );
  });

  it('maps statusCode 429 when message is sparse', () => {
    const error = Object.assign(new Error('Request failed'), {
      statusCode: 429,
    });

    expect(isAiProviderQuotaOrBillingError(error)).toBe(true);
  });

  it('does not treat generic 503 as provider billing exhaustion', () => {
    const error = Object.assign(new Error('Service unavailable'), {
      status: 503,
    });

    expect(isAiProviderQuotaOrBillingError(error)).toBe(false);
  });

  it('maps Anthropic billing URL failures', () => {
    const error = new Error(
      'Your credit balance is too low — see https://console.anthropic.com/settings/billing',
    );

    expect(formatUserFacingAiError(error)).toBe(
      AI_PROVIDER_UNAVAILABLE_MESSAGE,
    );
  });

  it('follows cause-chained quota errors', () => {
    const cause = new Error(
      'You exceeded your current quota: https://ai.google.dev/gemini-api/docs/rate-limits',
    );
    const error = new Error('generateContent failed');
    error.cause = cause;

    expect(formatUserFacingAiError(error)).toBe(
      AI_PROVIDER_UNAVAILABLE_MESSAGE,
    );
  });

  it('strips other provider errors that include URLs', () => {
    const error = new Error(
      'Upstream failed — see https://example.com/docs/error for details',
    );

    expect(formatUserFacingAiError(error, 'AI request failed')).toBe(
      'AI request failed',
    );
  });

  it('falls back for very long technical dumps', () => {
    expect(
      formatUserFacingAiError(new Error('x'.repeat(300)), 'AI request failed'),
    ).toBe('AI request failed');
  });

  it('keeps short safe application messages', () => {
    expect(
      formatUserFacingAiError(new Error('Thread has no message content')),
    ).toBe('Thread has no message content');
  });
});
