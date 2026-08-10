import { describe, expect, it } from 'vitest';

import { parseProblemDetail } from '../rightmove-api';

describe('parseProblemDetail', () => {
  it('joins title and detail', () => {
    expect(
      parseProblemDetail(
        JSON.stringify({
          title: 'Bad Request',
          detail: 'Validation error occurred.',
        }),
      ),
    ).toBe('Bad Request — Validation error occurred.');
  });

  it('appends nested validationError array details', () => {
    expect(
      parseProblemDetail(
        JSON.stringify({
          title: 'Bad Request',
          detail: 'Validation error occurred.',
          properties: {
            validationError: [
              {
                field: 'building.sizing.size',
                message: 'must be a number',
              },
            ],
          },
        }),
      ),
    ).toContain('building.sizing.size: must be a number');
  });

  it('formats field-error maps', () => {
    expect(
      parseProblemDetail(
        JSON.stringify({
          title: 'Bad Request',
          detail: 'Validation error occurred.',
          properties: {
            validationError: {
              'building.pricing.frequency': ['must not be null'],
            },
          },
        }),
      ),
    ).toContain('building.pricing.frequency: must not be null');
  });
});
