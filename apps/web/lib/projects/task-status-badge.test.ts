import { describe, expect, it } from 'vitest';

import {
  TASK_STATUS_BADGE_CLASS,
  isDoneTaskStatus,
  resolveTaskStatusTone,
  statusAfterDoneToggle,
  taskStatusBadgeClass,
  taskStatusDisplayLabel,
} from './task-status-badge';

describe('task status pills', () => {
  it('maps Dan’s slugs to the agreed tones', () => {
    expect(resolveTaskStatusTone('todo')).toBe('todo');
    expect(resolveTaskStatusTone('TODO')).toBe('todo');
    expect(resolveTaskStatusTone('open')).toBe('todo');
    expect(resolveTaskStatusTone('in_progress')).toBe('in_progress');
    expect(resolveTaskStatusTone('client_review')).toBe('client_review');
    expect(resolveTaskStatusTone('done')).toBe('done');
    expect(resolveTaskStatusTone('completed')).toBe('done');
    expect(resolveTaskStatusTone('cancelled')).toBe('cancelled');
    expect(resolveTaskStatusTone('canceled')).toBe('cancelled');
  });

  it('matches custom statuses by display label', () => {
    expect(resolveTaskStatusTone('waiting', 'Client Review')).toBe(
      'client_review',
    );
    expect(resolveTaskStatusTone('custom_open', 'TODO')).toBe('todo');
    expect(resolveTaskStatusTone('pipeline', 'In progress')).toBe(
      'in_progress',
    );
    expect(resolveTaskStatusTone('shipped', 'Done')).toBe('done');
    expect(resolveTaskStatusTone('void', 'Canceled')).toBe('cancelled');
  });

  it('keeps blocked red and unknowns neutral', () => {
    expect(resolveTaskStatusTone('blocked')).toBe('blocked');
    expect(resolveTaskStatusTone('invoiced', 'Invoiced')).toBe('unknown');
    expect(taskStatusBadgeClass('invoiced', 'Invoiced')).toBe(
      TASK_STATUS_BADGE_CLASS.unknown,
    );
  });

  it('uses a distinct class per known tone', () => {
    const tones = [
      'todo',
      'in_progress',
      'client_review',
      'done',
      'cancelled',
      'blocked',
    ] as const;
    const classes = tones.map((tone) => TASK_STATUS_BADGE_CLASS[tone]);
    expect(new Set(classes).size).toBe(tones.length);
  });

  it('treats done and completed as struck-through done tasks', () => {
    expect(isDoneTaskStatus('done')).toBe(true);
    expect(isDoneTaskStatus('completed')).toBe(true);
    expect(isDoneTaskStatus('complete')).toBe(true);
    expect(isDoneTaskStatus('todo')).toBe(false);
    expect(isDoneTaskStatus('cancelled')).toBe(false);
    expect(isDoneTaskStatus('in_progress')).toBe(false);
  });

  it('restores the previous status when a done checkbox is cleared', () => {
    expect(statusAfterDoneToggle('cancelled', true).remember).toBe('cancelled');
    expect(statusAfterDoneToggle('done', false, 'cancelled').status).toBe(
      'cancelled',
    );
    expect(statusAfterDoneToggle('done', false, 'in_progress').status).toBe(
      'in_progress',
    );
    expect(statusAfterDoneToggle('done', false, null).status).toBe('todo');
    expect(statusAfterDoneToggle('in_progress', true).status).toBe('done');
  });

  it('labels known slugs and leaves custom labels intact', () => {
    expect(taskStatusDisplayLabel('in_progress')).toBe('In progress');
    expect(taskStatusDisplayLabel('waiting', 'Client Review')).toBe(
      'Client Review',
    );
    expect(taskStatusDisplayLabel('awaiting_signoff')).toBe('Awaiting Signoff');
  });
});
