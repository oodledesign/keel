import { describe, expect, it } from 'vitest';

import { NativeHttpError } from './http';
import { uiStatusToDb } from './task-status';

describe('native task status', () => {
  it('maps phone statuses onto the tasks table', () => {
    expect(uiStatusToDb('pending')).toBe('todo');
    expect(uiStatusToDb('todo')).toBe('todo');
    expect(uiStatusToDb('in_progress')).toBe('in_progress');
    expect(uiStatusToDb('client_review')).toBe('client_review');
    expect(uiStatusToDb('completed')).toBe('done');
    expect(uiStatusToDb('done')).toBe('done');
  });

  it('rejects unknown statuses', () => {
    expect(() => uiStatusToDb('nope')).toThrow(NativeHttpError);
  });
});
