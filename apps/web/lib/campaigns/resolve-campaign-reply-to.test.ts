import { describe, expect, it } from 'vitest';

import { resolveCampaignReplyTo } from './resolve-campaign-reply-to';

describe('resolveCampaignReplyTo', () => {
  it('uses an explicit campaign Reply-To when set', () => {
    expect(
      resolveCampaignReplyTo({
        campaignReplyTo: '  team@example.co.uk  ',
        fromEmail: 'lizzie.jackman@example.co.uk',
        workspaceReplyTo: 'websiteadmin@example.co.uk',
      }),
    ).toBe('team@example.co.uk');
  });

  it('defaults blank Reply-To to the campaign From, not the workspace default', () => {
    expect(
      resolveCampaignReplyTo({
        campaignReplyTo: '   ',
        fromEmail: 'lizzie.jackman@example.co.uk',
        workspaceReplyTo: 'websiteadmin@example.co.uk',
      }),
    ).toBe('lizzie.jackman@example.co.uk');
  });

  it('defaults a missing Reply-To to From', () => {
    expect(
      resolveCampaignReplyTo({
        campaignReplyTo: null,
        fromEmail: 'lizzie.jackman@example.co.uk',
        workspaceReplyTo: 'websiteadmin@example.co.uk',
      }),
    ).toBe('lizzie.jackman@example.co.uk');
  });

  it('uses the workspace/safe fallback only when From is also blank', () => {
    expect(
      resolveCampaignReplyTo({
        campaignReplyTo: null,
        fromEmail: null,
        workspaceReplyTo: 'websiteadmin@example.co.uk',
      }),
    ).toBe('websiteadmin@example.co.uk');
  });

  it('returns undefined when every address is blank', () => {
    expect(
      resolveCampaignReplyTo({
        campaignReplyTo: '',
        fromEmail: '  ',
        workspaceReplyTo: null,
      }),
    ).toBeUndefined();
  });
});
