import { describe, expect, it } from 'vitest';

import {
  buildCreateProjectInsert,
  buildUpdateProjectPatch,
  createProjectSchema,
  mapProject,
  updateProjectSchema,
} from './projects';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

describe('createProjectSchema', () => {
  it('defaults is_phased to false like the web app', () => {
    const parsed = createProjectSchema.parse({
      name: 'Shopfront',
      account_id: ACCOUNT_ID,
    });

    expect(parsed.is_phased).toBe(false);
  });

  it('accepts an explicit phased create', () => {
    expect(
      createProjectSchema.parse({
        name: 'Shopfront',
        account_id: ACCOUNT_ID,
        is_phased: true,
      }).is_phased,
    ).toBe(true);
  });
});

describe('updateProjectSchema', () => {
  it('treats is_phased as optional so omitted patches stay board-mode', () => {
    const parsed = updateProjectSchema.parse({
      id: PROJECT_ID,
      name: 'Renamed',
    });
    expect(parsed.is_phased).toBeUndefined();
  });

  it('allows flipping is_phased true or false', () => {
    expect(
      updateProjectSchema.parse({ id: PROJECT_ID, is_phased: true }).is_phased,
    ).toBe(true);
    expect(
      updateProjectSchema.parse({ id: PROJECT_ID, is_phased: false }).is_phased,
    ).toBe(false);
  });
});

describe('buildCreateProjectInsert', () => {
  it('persists is_phased on the projects row and defaults false', () => {
    expect(
      buildCreateProjectInsert(
        createProjectSchema.parse({
          name: 'Shopfront',
          account_id: ACCOUNT_ID,
        }),
        USER_ID,
      ),
    ).toMatchObject({
      account_id: ACCOUNT_ID,
      name: 'Shopfront',
      title: 'Shopfront',
      project_type: 'delivery',
      is_phased: false,
      created_by: USER_ID,
    });

    expect(
      buildCreateProjectInsert(
        createProjectSchema.parse({
          name: 'Phased build',
          account_id: ACCOUNT_ID,
          is_phased: true,
        }),
        USER_ID,
      ).is_phased,
    ).toBe(true);
  });
});

describe('buildUpdateProjectPatch', () => {
  it('includes is_phased when flipping the board vs phased flag', () => {
    expect(
      buildUpdateProjectPatch(
        updateProjectSchema.parse({ id: PROJECT_ID, is_phased: true }),
      ),
    ).toEqual({ is_phased: true });

    expect(
      buildUpdateProjectPatch(
        updateProjectSchema.parse({ id: PROJECT_ID, is_phased: false }),
      ),
    ).toEqual({ is_phased: false });
  });

  it('does not invent phases or touch is_phased when the flag is omitted', () => {
    expect(
      buildUpdateProjectPatch(
        updateProjectSchema.parse({
          id: PROJECT_ID,
          description: 'No structure change',
        }),
      ),
    ).toEqual({ description: 'No structure change' });
  });
});

describe('mapProject', () => {
  it('exposes is_phased on list/search/get payloads', () => {
    expect(
      mapProject({
        id: PROJECT_ID,
        name: 'Shopfront',
        is_phased: true,
        account_id: ACCOUNT_ID,
      }),
    ).toMatchObject({
      id: PROJECT_ID,
      name: 'Shopfront',
      is_phased: true,
    });

    expect(
      mapProject({
        id: PROJECT_ID,
        name: 'Board only',
        is_phased: null,
      }).is_phased,
    ).toBe(false);
  });
});
