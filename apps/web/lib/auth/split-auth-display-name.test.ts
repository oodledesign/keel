import { describe, expect, it } from 'vitest';

import { splitAuthDisplayName } from './split-auth-display-name';

describe('splitAuthDisplayName', () => {
  it('prefers explicit first/last over full name', () => {
    expect(
      splitAuthDisplayName({
        firstName: 'Dan',
        lastName: 'Potter',
        fullName: 'Someone Else',
      }),
    ).toEqual({ firstName: 'Dan', lastName: 'Potter' });
  });

  it('uses Google given_name / family_name', () => {
    expect(
      splitAuthDisplayName({
        givenName: 'Jane',
        familyName: 'Smith',
      }),
    ).toEqual({ firstName: 'Jane', lastName: 'Smith' });
  });

  it('splits full_name when parts are missing', () => {
    expect(
      splitAuthDisplayName({
        fullName: 'Oodle Design Owner',
      }),
    ).toEqual({ firstName: 'Oodle', lastName: 'Design Owner' });
  });

  it('returns empty parts when nothing is available', () => {
    expect(splitAuthDisplayName({})).toEqual({ firstName: '', lastName: '' });
  });
});
