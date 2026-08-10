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

  it('formats root-level single validationError objects', () => {
    expect(
      parseProblemDetail(
        JSON.stringify({
          title: 'Bad Request',
          detail: 'Validation error occurred.',
          validationError: {
            field: 'building.location.longitude',
            message: 'Longitude must be to a maximum of 6 decimal places.',
          },
        }),
      ),
    ).toBe(
      'Bad Request — Validation error occurred. — building.location.longitude: Longitude must be to a maximum of 6 decimal places.',
    );
  });
});
