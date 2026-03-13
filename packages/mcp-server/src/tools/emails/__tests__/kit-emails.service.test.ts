import { describe, expect, it } from 'vitest';

import {
  type KitEmailsDeps,
  createKitEmailsService,
} from '../kit-emails.service';

function createDeps(
  files: Record<string, string>,
  directories: string[],
): KitEmailsDeps {
  const store = { ...files };
  const dirSet = new Set(directories);

  return {
    rootPath: '/repo',
    async readFile(filePath: string) {
      if (!(filePath in store)) {
        const error = new Error(
          `ENOENT: no such file: ${filePath}`,
        ) as NodeJS.ErrnoException;

        error.code = 'ENOENT';
        throw error;
      }

      return store[filePath]!;
    },
    async readdir(dirPath: string) {
      if (!dirSet.has(dirPath)) {
        return [];
      }

      return Object.keys(store)
        .filter((p) => {
          const parent = p.substring(0, p.lastIndexOf('/'));
          return parent === dirPath;
        })
        .map((p) => p.substring(p.lastIndexOf('/') + 1));
    },
    async fileExists(filePath: string) {
      return filePath in store || dirSet.has(filePath);
    },
    async renderReactEmail() {
      return null;
    },
  };
}

const REACT_DIR = '/repo/packages/email-templates/src/emails';
const SUPABASE_DIR = '/repo/apps/web/supabase/templates';

describe('KitEmailsService.list', () => {
  it('discovers React Email templates with -email suffix in id', async () => {
    const deps = createDeps(
      {
        [`${REACT_DIR}/invite.email.tsx`]:
          'export function renderInviteEmail() {}',
        [`${REACT_DIR}/otp.email.tsx`]: 'export function renderOtpEmail() {}',
      },
      [REACT_DIR],
    );

    const service = createKitEmailsService(deps);
    const result = await service.list();

    expect(result.templates).toHaveLength(2);
    expect(result.categories).toEqual(['transactional']);
    expect(result.total).toBe(2);

    const invite = result.templates.find((t) => t.id === 'invite-email');

    expect(invite).toBeDefined();
    expect(invite!.name).toBe('Invite');
    expect(invite!.category).toBe('transactional');
    expect(invite!.file).toBe(
      'packages/email-templates/src/emails/invite.email.tsx',
    );

    const otp = result.templates.find((t) => t.id === 'otp-email');

    expect(otp).toBeDefined();
    expect(otp!.name).toBe('Otp');
  });

  it('discovers Supabase Auth HTML templates', async () => {
    const deps = createDeps(
      {
        [`${SUPABASE_DIR}/magic-link.html`]: '<html>magic</html>',
        [`${SUPABASE_DIR}/reset-password.html`]: '<html>reset</html>',
      },
      [SUPABASE_DIR],
    );

    const service = createKitEmailsService(deps);
    const result = await service.list();

    expect(result.templates).toHaveLength(2);
    expect(result.categories).toEqual(['supabase-auth']);

    const magicLink = result.templates.find((t) => t.id === 'magic-link');

    expect(magicLink).toBeDefined();
    expect(magicLink!.name).toBe('Magic Link');
    expect(magicLink!.category).toBe('supabase-auth');
    expect(magicLink!.file).toBe('apps/web/supabase/templates/magic-link.html');
  });

  it('discovers both types and returns sorted categories', async () => {
    const deps = createDeps(
      {
        [`${REACT_DIR}/invite.email.tsx`]:
          'export function renderInviteEmail() {}',
        [`${SUPABASE_DIR}/confirm-email.html`]: '<html>confirm</html>',
      },
      [REACT_DIR, SUPABASE_DIR],
    );

    const service = createKitEmailsService(deps);
    const result = await service.list();

    expect(result.templates).toHaveLength(2);
    expect(result.categories).toEqual(['supabase-auth', 'transactional']);
    expect(result.total).toBe(2);
  });

  it('handles empty directories gracefully', async () => {
    const deps = createDeps({}, []);

    const service = createKitEmailsService(deps);
    const result = await service.list();

    expect(result.templates).toEqual([]);
    expect(result.categories).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('ignores non-email files in the directories', async () => {
    const deps = createDeps(
      {
        [`${REACT_DIR}/invite.email.tsx`]:
          'export function renderInviteEmail() {}',
        [`${REACT_DIR}/utils.ts`]: 'export const helper = true;',
        [`${REACT_DIR}/README.md`]: '# readme',
        [`${SUPABASE_DIR}/magic-link.html`]: '<html>magic</html>',
        [`${SUPABASE_DIR}/config.json`]: '{}',
      },
      [REACT_DIR, SUPABASE_DIR],
    );

    const service = createKitEmailsService(deps);
    const result = await service.list();

    expect(result.templates).toHaveLength(2);
  });

  it('avoids id collision between React otp-email and Supabase otp', async () => {
    const deps = createDeps(
      {
        [`${REACT_DIR}/otp.email.tsx`]: 'export function renderOtpEmail() {}',
        [`${SUPABASE_DIR}/otp.html`]: '<html>otp</html>',
      },
      [REACT_DIR, SUPABASE_DIR],
    );

    const service = createKitEmailsService(deps);
    const result = await service.list();

    const ids = result.templates.map((t) => t.id);

    expect(ids).toContain('otp-email');
    expect(ids).toContain('otp');
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('KitEmailsService.read', () => {
  it('reads a React Email template and extracts props', async () => {
    const source = `
interface Props {
  teamName: string;
  teamLogo?: string;
  inviter: string | undefined;
  invitedUserEmail: string;
  link: string;
  productName: string;
  language?: string;
}

export async function renderInviteEmail(props: Props) {}
`;

    const deps = createDeps(
      {
        [`${REACT_DIR}/invite.email.tsx`]: source,
      },
      [REACT_DIR],
    );

    const service = createKitEmailsService(deps);
    const result = await service.read({ id: 'invite-email' });

    expect(result.id).toBe('invite-email');
    expect(result.name).toBe('Invite');
    expect(result.category).toBe('transactional');
    expect(result.source).toBe(source);

    expect(result.props).toEqual([
      { name: 'teamName', type: 'string', required: true },
      { name: 'teamLogo', type: 'string', required: false },
      { name: 'inviter', type: 'string | undefined', required: true },
      { name: 'invitedUserEmail', type: 'string', required: true },
      { name: 'link', type: 'string', required: true },
      { name: 'productName', type: 'string', required: true },
      { name: 'language', type: 'string', required: false },
    ]);
  });

  it('reads a Supabase HTML template with empty props', async () => {
    const html = '<html><body>Magic Link</body></html>';

    const deps = createDeps(
      {
        [`${SUPABASE_DIR}/magic-link.html`]: html,
      },
      [SUPABASE_DIR],
    );

    const service = createKitEmailsService(deps);
    const result = await service.read({ id: 'magic-link' });

    expect(result.id).toBe('magic-link');
    expect(result.source).toBe(html);
    expect(result.props).toEqual([]);
  });

  it('throws for unknown template id', async () => {
    const deps = createDeps({}, []);

    const service = createKitEmailsService(deps);

    await expect(service.read({ id: 'nonexistent' })).rejects.toThrow(
      'Email template not found: "nonexistent"',
    );
  });

  it('handles templates without Props interface', async () => {
    const source =
      'export async function renderSimpleEmail() { return { html: "" }; }';

    const deps = createDeps(
      {
        [`${REACT_DIR}/simple.email.tsx`]: source,
      },
      [REACT_DIR],
    );

    const service = createKitEmailsService(deps);
    const result = await service.read({ id: 'simple-email' });

    expect(result.props).toEqual([]);
  });
});

describe('Path safety', () => {
  it('rejects ids with path traversal', async () => {
    const deps = createDeps({}, []);
    const service = createKitEmailsService(deps);

    await expect(service.read({ id: '../etc/passwd' })).rejects.toThrow(
      'Template id must not contain ".."',
    );
  });

  it('rejects ids with forward slashes', async () => {
    const deps = createDeps({}, []);
    const service = createKitEmailsService(deps);

    await expect(service.read({ id: 'foo/bar' })).rejects.toThrow(
      'Template id must not include path separators',
    );
  });

  it('rejects ids with backslashes', async () => {
    const deps = createDeps({}, []);
    const service = createKitEmailsService(deps);

    await expect(service.read({ id: 'foo\\bar' })).rejects.toThrow(
      'Template id must not include path separators',
    );
  });
});
