import { describe, expect, it } from 'vitest';

import {
  isNextProductionDigestMessage,
  toPublicOnboardingError,
} from './onboarding-public-error';

describe('toPublicOnboardingError', () => {
  it('passes through short user-facing messages', () => {
    expect(toPublicOnboardingError('Workspace not found.')).toBe(
      'Workspace not found.',
    );
  });

  it('hides PostgREST and constraint failures', () => {
    expect(
      toPublicOnboardingError(
        'duplicate key value violates unique constraint "businesses_slug_key"',
      ),
    ).toBe('Could not create your workspace. Please try again.');
    expect(
      toPublicOnboardingError(
        'Could not find the function public.create_team_account',
      ),
    ).toBe('Could not create your workspace. Please try again.');
  });

  it('hides the Next.js production RSC digest', () => {
    const digest =
      'An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details.';
    expect(toPublicOnboardingError(digest)).toBe(
      'Could not create your workspace. Please try again.',
    );
    expect(isNextProductionDigestMessage(digest)).toBe(true);
  });
});
