import { describe, expect, it } from 'vitest';

import {
  type CanvasAiRequest,
  buildCanvasAiPrompt,
  parseCanvasAiResponse,
} from './canvas-ai';

const request: CanvasAiRequest = {
  mode: 'content_posts',
  prompt: '3 posts a week',
  startDate: '2026-10-05',
  endDate: '2026-10-18',
  platforms: ['linkedin', 'instagram'],
};

describe('content_posts', () => {
  it('asks for posts inside the window and allowed channels', () => {
    const { user } = buildCanvasAiPrompt(request, 'ctx', '2026-10-05');
    expect(user).toContain('2026-10-05 to 2026-10-18');
    expect(user).toContain('linkedin, instagram');
  });

  it('keeps valid posts, drops out-of-window/duplicates, fixes channels', () => {
    const raw = JSON.stringify({
      posts: [
        {
          postDate: '2026-10-12',
          title: 'Launch teaser',
          body: 'Big news soon',
          platforms: ['linkedin', 'tiktok'],
          status: 'draft',
        },
        { postDate: '2026-10-12', title: 'launch teaser', platforms: [] },
        { postDate: '2026-09-01', title: 'Too early', platforms: ['linkedin'] },
        { postDate: '2026-11-01', title: 'Too late', platforms: ['linkedin'] },
        {
          postDate: '2026-10-06',
          title: 'No channel',
          platforms: ['tiktok'],
          status: 'weird',
        },
      ],
    });
    const result = parseCanvasAiResponse(request, raw);
    expect(result.mode).toBe('content_posts');
    if (result.mode !== 'content_posts') return;
    expect(result.posts.map((p) => p.title)).toEqual([
      'No channel',
      'Launch teaser',
    ]);
    // Unknown channel dropped; falls back to the first allowed one.
    expect(result.posts[0]!.platforms).toEqual(['linkedin']);
    expect(result.posts[0]!.status).toBe('draft');
    expect(result.posts[1]!.platforms).toEqual(['linkedin']);
  });

  it('rejects unreadable replies', () => {
    expect(() => parseCanvasAiResponse(request, 'not json')).toThrow();
  });
});
