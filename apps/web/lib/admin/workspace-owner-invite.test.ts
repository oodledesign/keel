import { describe, expect, it } from 'vitest';

import { summarizeAccessConfig } from './user-invites.schema';
import { renderWorkspaceOwnerInviteEmail } from './workspace-owner-invite';

describe('workspace owner invite email', () => {
  it('names Ozer, the workspace, and the owner role', () => {
    const { html, subject } = renderWorkspaceOwnerInviteEmail({
      workspaceName: 'Acme Design',
      inviterName: 'Dan',
      acceptUrl: 'https://ozer.so/join/user-invite/accept?invite_token=abc',
      productName: 'Ozer',
    });

    expect(subject).toBe("You're invited to own Acme Design on Ozer");
    expect(html).toContain('Ozer');
    expect(html).toContain('Acme Design');
    expect(html).toContain('owner');
    expect(html).toContain(
      'https://ozer.so/join/user-invite/accept?invite_token=abc',
    );
    expect(html).toContain('Accept invitation');
  });

  it('escapes workspace and inviter names', () => {
    const { html, subject } = renderWorkspaceOwnerInviteEmail({
      workspaceName: 'A&B <Studio>',
      inviterName: 'Dan <admin>',
      acceptUrl: 'https://ozer.so/join/user-invite/accept?invite_token=abc',
    });

    expect(subject).toContain('A&B <Studio>');
    expect(html).toContain('A&amp;B &lt;Studio&gt;');
    expect(html).toContain('Dan &lt;admin&gt;');
    expect(html).not.toContain('Dan <admin>');
  });
});

describe('summarizeAccessConfig provisioned owner', () => {
  it('describes the invite as ownership of the named workspace', () => {
    expect(
      summarizeAccessConfig({
        provisionedOwner: {
          accountId: '00000000-0000-4000-8000-000000000001',
          slug: 'acme-design',
          workspaceName: 'Acme Design',
        },
      }),
    ).toBe('Owner of Acme Design');
  });
});
