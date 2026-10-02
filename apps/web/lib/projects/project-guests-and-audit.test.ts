import { describe, expect, it } from 'vitest';

import { type ProjectGuestPermissions } from './project-guests.types';

describe('Project Guest Permissions with edit_all_tasks', () => {
  it('correctly defaults edit_all_tasks to false', () => {
    const permissions: ProjectGuestPermissions = {
      comment: true,
      create_task: true,
      edit_own_task: true,
      edit_all_tasks: false,
      edit_canvas: false,
    };
    expect(permissions.edit_all_tasks).toBe(false);
    expect(permissions.edit_own_task).toBe(true);
  });

  it('allows edit_all_tasks to be granted alongside other capabilities', () => {
    const permissions: ProjectGuestPermissions = {
      comment: true,
      create_task: true,
      edit_own_task: true,
      edit_all_tasks: true,
      edit_canvas: true,
    };
    expect(permissions.edit_all_tasks).toBe(true);
    expect(permissions.edit_canvas).toBe(true);
  });
});
