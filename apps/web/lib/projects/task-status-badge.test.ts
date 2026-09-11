import { describe, expect, it } from 'vitest';

import {
  TASK_STATUS_BADGE_CLASS,
  TASK_STATUS_LABELS,
  resolveTaskStatusBadgeKey,
  taskStatusBadgeClass,
  taskStatusLabel,
} from './task-status-badge';

describe('task status pills', () => {
  it('maps todo aliases to the yellow/amber pill', () => {
    for (const status of ['todo', 'TODO', 'To do', 'open', 'pending']) {
      expect(resolveTaskStatusBadgeKey(status)).toBe('todo');
      expect(taskStatusBadgeClass(status)).toBe(TASK_STATUS_BADGE_CLASS.todo);
    }
    expect(taskStatusLabel('TODO')).toBe('To do');
    expect(taskStatusLabel('open')).toBe('To do');
  });

  it('maps done aliases to the green/sage pill', () => {
    for (const status of ['done', 'Done', 'completed', 'complete']) {
      expect(resolveTaskStatusBadgeKey(status)).toBe('done');
      expect(taskStatusBadgeClass(status)).toBe(TASK_STATUS_BADGE_CLASS.done);
    }
    expect(taskStatusLabel('completed')).toBe('Done');
  });

  it('keeps distinct colours for other known statuses', () => {
    expect(taskStatusBadgeClass('in_progress')).toBe(
      TASK_STATUS_BADGE_CLASS.in_progress,
    );
    expect(taskStatusBadgeClass('client_review')).toBe(
      TASK_STATUS_BADGE_CLASS.client_review,
    );
    expect(taskStatusBadgeClass('review')).toBe(
      TASK_STATUS_BADGE_CLASS.client_review,
    );
    expect(taskStatusBadgeClass('cancelled')).toBe(
      TASK_STATUS_BADGE_CLASS.cancelled,
    );
    expect(taskStatusBadgeClass('blocked')).toBe(
      TASK_STATUS_BADGE_CLASS.blocked,
    );

    const known = [
      'todo',
      'in_progress',
      'client_review',
      'done',
      'cancelled',
      'blocked',
    ] as const;
    expect(
      new Set(known.map((status) => taskStatusBadgeClass(status))).size,
    ).toBe(known.length);
  });

  it('leaves unknown custom statuses neutral', () => {
    expect(resolveTaskStatusBadgeKey('waiting_on_client')).toBe('unknown');
    expect(taskStatusBadgeClass('invoiced')).toBe(
      TASK_STATUS_BADGE_CLASS.unknown,
    );
    expect(taskStatusBadgeClass('invoiced')).not.toBe(
      TASK_STATUS_BADGE_CLASS.todo,
    );
    expect(taskStatusBadgeClass('invoiced')).not.toBe(
      TASK_STATUS_BADGE_CLASS.done,
    );
    expect(taskStatusLabel('waiting_on_client')).toBe('Waiting On Client');
  });

  it('labels the built-in statuses', () => {
    expect(TASK_STATUS_LABELS.todo).toBe('To do');
    expect(TASK_STATUS_LABELS.done).toBe('Done');
    expect(taskStatusLabel('in_progress')).toBe('In progress');
  });
});
