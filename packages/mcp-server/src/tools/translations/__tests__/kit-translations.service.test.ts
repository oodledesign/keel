import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  type KitTranslationsDeps,
  createKitTranslationsService,
} from '../kit-translations.service';

function createDeps(
  files: Record<string, string>,
  directories: string[],
): KitTranslationsDeps & { _files: Record<string, string> } {
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
    async writeFile(filePath: string, content: string) {
      store[filePath] = content;
    },
    async readdir(dirPath: string) {
      const entries = new Set<string>();

      for (const filePath of Object.keys(store)) {
        if (path.dirname(filePath) === dirPath) {
          entries.add(path.basename(filePath));
        }
      }

      for (const dir of dirSet) {
        if (path.dirname(dir) === dirPath) {
          entries.add(path.basename(dir));
        }
      }

      return Array.from(entries.values());
    },
    async stat(targetPath: string) {
      if (!dirSet.has(targetPath)) {
        const error = new Error(
          `ENOENT: no such directory: ${targetPath}`,
        ) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      }

      return {
        isDirectory: () => true,
      };
    },
    async fileExists(filePath: string) {
      return filePath in store || dirSet.has(filePath);
    },
    async mkdir(dirPath: string) {
      dirSet.add(dirPath);
    },
    async unlink(filePath: string) {
      delete store[filePath];
    },
    async rmdir(dirPath: string) {
      const prefix = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;

      for (const key of Object.keys(store)) {
        if (key.startsWith(prefix)) {
          delete store[key];
        }
      }

      for (const dir of dirSet) {
        if (dir === dirPath || dir.startsWith(prefix)) {
          dirSet.delete(dir);
        }
      }
    },
    get _files() {
      return store;
    },
  };
}

describe('KitTranslationsService.list', () => {
  it('lists and flattens translations with missing namespace fallback', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps(
      {
        [`${localesRoot}/en/common.json`]: JSON.stringify({
          header: { title: 'Dashboard' },
        }),
        [`${localesRoot}/en/auth.json`]: JSON.stringify({
          login: 'Sign In',
        }),
        [`${localesRoot}/es/common.json`]: JSON.stringify({
          header: { title: 'Panel' },
        }),
      },
      [localesRoot, `${localesRoot}/en`, `${localesRoot}/es`],
    );

    const service = createKitTranslationsService(deps);
    const result = await service.list();

    expect(result.base_locale).toBe('en');
    expect(result.locales).toEqual(['en', 'es']);
    expect(result.namespaces).toEqual(['auth', 'common']);
    expect(result.translations.en.common['header.title']).toBe('Dashboard');
    expect(result.translations.en.auth.login).toBe('Sign In');
    expect(result.translations.es.common['header.title']).toBe('Panel');
    expect(result.translations.es.auth).toEqual({});
  });
});

describe('KitTranslationsService.update', () => {
  it('updates nested translation keys', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps(
      {
        [`${localesRoot}/en/common.json`]: JSON.stringify({}),
      },
      [localesRoot, `${localesRoot}/en`],
    );

    const service = createKitTranslationsService(deps);
    await service.update({
      locale: 'en',
      namespace: 'common',
      key: 'header.title',
      value: 'Home',
    });

    const content = deps._files[`${localesRoot}/en/common.json`]!;
    expect(JSON.parse(content)).toEqual({ header: { title: 'Home' } });
  });

  it('rejects paths outside locales root', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps(
      {
        [`${localesRoot}/en/common.json`]: JSON.stringify({}),
      },
      [localesRoot, `${localesRoot}/en`],
    );

    const service = createKitTranslationsService(deps);

    await expect(
      service.update({
        locale: '../secrets',
        namespace: 'common',
        key: 'header.title',
        value: 'Oops',
      }),
    ).rejects.toThrow('locale');
  });

  it('rejects namespace path segments', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps(
      {
        [`${localesRoot}/en/common.json`]: JSON.stringify({}),
      },
      [localesRoot, `${localesRoot}/en`],
    );

    const service = createKitTranslationsService(deps);

    await expect(
      service.update({
        locale: 'en',
        namespace: 'nested/common',
        key: 'header.title',
        value: 'Oops',
      }),
    ).rejects.toThrow('namespace');
  });
});

describe('KitTranslationsService.stats', () => {
  it('computes coverage using base locale keys', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps(
      {
        [`${localesRoot}/en/common.json`]: JSON.stringify({
          header: { title: 'Dashboard', subtitle: 'Welcome' },
        }),
        [`${localesRoot}/es/common.json`]: JSON.stringify({
          header: { title: 'Panel' },
        }),
      },
      [localesRoot, `${localesRoot}/en`, `${localesRoot}/es`],
    );

    const service = createKitTranslationsService(deps);
    const result = await service.stats();

    expect(result.base_locale).toBe('en');
    expect(result.total_keys).toBe(2);
    expect(result.coverage.en.translated).toBe(2);
    expect(result.coverage.es.translated).toBe(1);
    expect(result.coverage.es.missing).toBe(1);
  });
});

describe('KitTranslationsService.addNamespace', () => {
  it('creates namespace JSON in all locale directories', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps(
      {
        [`${localesRoot}/en/common.json`]: JSON.stringify({}),
        [`${localesRoot}/es/common.json`]: JSON.stringify({}),
      },
      [localesRoot, `${localesRoot}/en`, `${localesRoot}/es`],
    );

    const service = createKitTranslationsService(deps);
    const result = await service.addNamespace({ namespace: 'billing' });

    expect(result.success).toBe(true);
    expect(result.namespace).toBe('billing');
    expect(result.files_created).toHaveLength(2);
    expect(deps._files[`${localesRoot}/en/billing.json`]).toBe(
      JSON.stringify({}, null, 2),
    );
    expect(deps._files[`${localesRoot}/es/billing.json`]).toBe(
      JSON.stringify({}, null, 2),
    );
  });

  it('throws if namespace already exists', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps(
      {
        [`${localesRoot}/en/common.json`]: JSON.stringify({}),
      },
      [localesRoot, `${localesRoot}/en`],
    );

    const service = createKitTranslationsService(deps);

    await expect(service.addNamespace({ namespace: 'common' })).rejects.toThrow(
      'already exists',
    );
  });

  it('throws if no locales exist', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps({}, [localesRoot]);

    const service = createKitTranslationsService(deps);

    await expect(
      service.addNamespace({ namespace: 'billing' }),
    ).rejects.toThrow('No locales exist');
  });

  it('rejects path traversal in namespace', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps(
      {
        [`${localesRoot}/en/common.json`]: JSON.stringify({}),
      },
      [localesRoot, `${localesRoot}/en`],
    );

    const service = createKitTranslationsService(deps);

    await expect(
      service.addNamespace({ namespace: '../secrets' }),
    ).rejects.toThrow('namespace');

    await expect(
      service.addNamespace({ namespace: 'foo/bar' }),
    ).rejects.toThrow('namespace');
  });
});

describe('KitTranslationsService.addLocale', () => {
  it('creates locale directory with namespace files', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps(
      {
        [`${localesRoot}/en/common.json`]: JSON.stringify({ hello: 'Hello' }),
        [`${localesRoot}/en/auth.json`]: JSON.stringify({ login: 'Login' }),
      },
      [localesRoot, `${localesRoot}/en`],
    );

    const service = createKitTranslationsService(deps);
    const result = await service.addLocale({ locale: 'fr' });

    expect(result.success).toBe(true);
    expect(result.locale).toBe('fr');
    expect(result.files_created).toHaveLength(2);
    expect(deps._files[`${localesRoot}/fr/auth.json`]).toBe(
      JSON.stringify({}, null, 2),
    );
    expect(deps._files[`${localesRoot}/fr/common.json`]).toBe(
      JSON.stringify({}, null, 2),
    );
  });

  it('throws if locale already exists', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps(
      {
        [`${localesRoot}/en/common.json`]: JSON.stringify({}),
      },
      [localesRoot, `${localesRoot}/en`],
    );

    const service = createKitTranslationsService(deps);

    await expect(service.addLocale({ locale: 'en' })).rejects.toThrow(
      'already exists',
    );
  });

  it('works when no namespaces exist yet', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps({}, [localesRoot]);

    const service = createKitTranslationsService(deps);
    const result = await service.addLocale({ locale: 'en' });

    expect(result.success).toBe(true);
    expect(result.files_created).toHaveLength(0);
  });

  it('rejects path traversal in locale', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps({}, [localesRoot]);

    const service = createKitTranslationsService(deps);

    await expect(service.addLocale({ locale: '../hack' })).rejects.toThrow(
      'locale',
    );

    await expect(service.addLocale({ locale: 'foo\\bar' })).rejects.toThrow(
      'locale',
    );
  });
});

describe('KitTranslationsService.removeNamespace', () => {
  it('deletes namespace files from all locales', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps(
      {
        [`${localesRoot}/en/common.json`]: JSON.stringify({}),
        [`${localesRoot}/en/auth.json`]: JSON.stringify({}),
        [`${localesRoot}/es/common.json`]: JSON.stringify({}),
        [`${localesRoot}/es/auth.json`]: JSON.stringify({}),
      },
      [localesRoot, `${localesRoot}/en`, `${localesRoot}/es`],
    );

    const service = createKitTranslationsService(deps);
    const result = await service.removeNamespace({ namespace: 'auth' });

    expect(result.success).toBe(true);
    expect(result.namespace).toBe('auth');
    expect(result.files_removed).toHaveLength(2);
    expect(deps._files[`${localesRoot}/en/auth.json`]).toBeUndefined();
    expect(deps._files[`${localesRoot}/es/auth.json`]).toBeUndefined();
    expect(deps._files[`${localesRoot}/en/common.json`]).toBeDefined();
  });

  it('throws if namespace does not exist', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps(
      {
        [`${localesRoot}/en/common.json`]: JSON.stringify({}),
      },
      [localesRoot, `${localesRoot}/en`],
    );

    const service = createKitTranslationsService(deps);

    await expect(
      service.removeNamespace({ namespace: 'nonexistent' }),
    ).rejects.toThrow('does not exist');
  });

  it('rejects path traversal', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps({}, [localesRoot]);

    const service = createKitTranslationsService(deps);

    await expect(
      service.removeNamespace({ namespace: '../etc' }),
    ).rejects.toThrow('namespace');
  });
});

describe('KitTranslationsService.removeLocale', () => {
  it('deletes entire locale directory', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps(
      {
        [`${localesRoot}/en/common.json`]: JSON.stringify({}),
        [`${localesRoot}/es/common.json`]: JSON.stringify({}),
      },
      [localesRoot, `${localesRoot}/en`, `${localesRoot}/es`],
    );

    const service = createKitTranslationsService(deps);
    const result = await service.removeLocale({ locale: 'es' });

    expect(result.success).toBe(true);
    expect(result.locale).toBe('es');
    expect(result.path_removed).toBe(`${localesRoot}/es`);
    expect(deps._files[`${localesRoot}/es/common.json`]).toBeUndefined();
    expect(deps._files[`${localesRoot}/en/common.json`]).toBeDefined();
  });

  it('throws if locale does not exist', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps({}, [localesRoot]);

    const service = createKitTranslationsService(deps);

    await expect(service.removeLocale({ locale: 'fr' })).rejects.toThrow(
      'does not exist',
    );
  });

  it('throws when trying to delete base locale', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps(
      {
        [`${localesRoot}/en/common.json`]: JSON.stringify({}),
        [`${localesRoot}/es/common.json`]: JSON.stringify({}),
      },
      [localesRoot, `${localesRoot}/en`, `${localesRoot}/es`],
    );

    const service = createKitTranslationsService(deps);

    await expect(service.removeLocale({ locale: 'en' })).rejects.toThrow(
      'Cannot remove base locale',
    );
  });

  it('rejects path traversal', async () => {
    const localesRoot = '/repo/apps/web/public/locales';
    const deps = createDeps({}, [localesRoot]);

    const service = createKitTranslationsService(deps);

    await expect(service.removeLocale({ locale: '../hack' })).rejects.toThrow(
      'locale',
    );
  });
});
