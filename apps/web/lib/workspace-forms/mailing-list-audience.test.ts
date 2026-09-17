import { describe, expect, it } from 'vitest';

import {
  audienceListIdsFromFormInput,
  parseAudienceListIdsFromValues,
  resolveMailingSignupListIds,
  subscriberPickableAudienceLists,
} from './mailing-list-audience';

const NEWS = '11111111-1111-4111-8111-111111111111';
const EVENTS = '22222222-2222-4222-8222-222222222222';
const PRIVATE = '33333333-3333-4333-8333-333333333333';

describe('mailing list form audience targeting', () => {
  it('prefers the multi-id array and falls back to a single id', () => {
    expect(
      audienceListIdsFromFormInput({
        audienceListId: NEWS,
        audienceListIds: [EVENTS, NEWS],
      }),
    ).toEqual([EVENTS, NEWS]);
    expect(audienceListIdsFromFormInput({ audienceListId: NEWS })).toEqual([
      NEWS,
    ]);
    expect(audienceListIdsFromFormInput({})).toEqual([]);
  });

  it('parses picked ids from the reserved form value', () => {
    expect(
      parseAudienceListIdsFromValues({
        audience_lists: `${NEWS},${EVENTS}`,
      }),
    ).toEqual([NEWS, EVENTS]);
  });

  it('auto-joins a single configured list', () => {
    expect(
      resolveMailingSignupListIds({
        configured: [{ id: NEWS, isPublic: true }],
        pickedIds: [],
      }),
    ).toEqual([NEWS]);
  });

  it('joins every configured list when the subscriber skips the picker', () => {
    expect(
      resolveMailingSignupListIds({
        configured: [
          { id: NEWS, isPublic: true },
          { id: EVENTS, isPublic: true },
          { id: PRIVATE, isPublic: false },
        ],
        pickedIds: [],
      }),
    ).toEqual([NEWS, EVENTS, PRIVATE]);
  });

  it('joins the public subset plus private targeted lists', () => {
    expect(
      resolveMailingSignupListIds({
        configured: [
          { id: NEWS, isPublic: true },
          { id: EVENTS, isPublic: true },
          { id: PRIVATE, isPublic: false },
        ],
        pickedIds: [EVENTS],
      }),
    ).toEqual([PRIVATE, EVENTS]);
  });

  it('only offers public lists to the subscriber', () => {
    expect(
      subscriberPickableAudienceLists([
        { id: NEWS, name: 'News', isPublic: true },
        { id: PRIVATE, name: 'Staff', isPublic: false },
      ]),
    ).toEqual([{ id: NEWS, name: 'News', isPublic: true }]);
  });
});
