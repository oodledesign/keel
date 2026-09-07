import { describe, expect, it } from 'vitest';

import {
  NativeComposeTypeSchema,
  NativeCreateThreadBodySchema,
  NativeSendMessageBodySchema,
} from './messages-shared';

describe('native message contracts', () => {
  it('accepts the four compose types', () => {
    expect(NativeComposeTypeSchema.parse('direct')).toBe('direct');
    expect(NativeComposeTypeSchema.parse('group')).toBe('group');
    expect(NativeComposeTypeSchema.parse('job')).toBe('job');
    expect(NativeComposeTypeSchema.parse('client')).toBe('client');
  });

  it('treats empty job_id as null so clients can omit a project', () => {
    const parsed = NativeCreateThreadBodySchema.parse({
      workspace: 'oodle',
      type: 'direct',
      job_id: '',
    });
    expect(parsed.job_id).toBeNull();
  });

  it('keeps a project UUID on job_id', () => {
    const parsed = NativeCreateThreadBodySchema.parse({
      workspace: 'oodle',
      type: 'job',
      job_id: '11111111-1111-4111-8111-111111111111',
    });
    expect(parsed.job_id).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('defaults send body to an empty string', () => {
    const parsed = NativeSendMessageBodySchema.parse({
      workspace: 'oodle',
    });
    expect(parsed.body).toBe('');
  });
});
