import path from 'node:path';

import type {
  KitTranslationsAddLocaleInput,
  KitTranslationsAddLocaleSuccess,
  KitTranslationsAddNamespaceInput,
  KitTranslationsAddNamespaceSuccess,
  KitTranslationsListSuccess,
  KitTranslationsRemoveLocaleInput,
  KitTranslationsRemoveLocaleSuccess,
  KitTranslationsRemoveNamespaceInput,
  KitTranslationsRemoveNamespaceSuccess,
  KitTranslationsStatsSuccess,
  KitTranslationsUpdateInput,
  KitTranslationsUpdateSuccess,
} from './schema';

export interface KitTranslationsDeps {
  rootPath: string;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  readdir(dirPath: string): Promise<string[]>;
  stat(path: string): Promise<{ isDirectory(): boolean }>;
  fileExists(filePath: string): Promise<boolean>;
  mkdir(dirPath: string): Promise<void>;
  unlink(filePath: string): Promise<void>;
  rmdir(dirPath: string): Promise<void>;
}

export function createKitTranslationsService(deps: KitTranslationsDeps) {
  return new KitTranslationsService(deps);
}

export class KitTranslationsService {
  constructor(private readonly deps: KitTranslationsDeps) {}

  async list(): Promise<Omit<KitTranslationsListSuccess, 'ok'>> {
    const localesRoot = this.getLocalesRoot();
    const locales = await this.getLocaleDirectories(localesRoot);
    const translations: Record<
      string,
      Record<string, Record<string, string>>
    > = {};
    const namespaces = new Set<string>();

    for (const locale of locales) {
      const localeDir = this.resolveLocaleDir(localesRoot, locale);
      const files = await this.deps.readdir(localeDir);
      const jsonFiles = files.filter((file) => file.endsWith('.json'));

      translations[locale] = {};

      for (const file of jsonFiles) {
        const namespace = file.replace(/\.json$/, '');
        const filePath = path.join(localeDir, file);

        namespaces.add(namespace);

        translations[locale][namespace] =
          await this.readFlatTranslations(filePath);
      }
    }

    const namespaceList = Array.from(namespaces).sort();

    for (const locale of locales) {
      for (const namespace of namespaceList) {
        if (!translations[locale]?.[namespace]) {
          translations[locale]![namespace] = {};
        }
      }
    }

    return {
      base_locale: locales[0] ?? '',
      locales,
      namespaces: namespaceList,
      translations,
    };
  }

  async update(
    input: KitTranslationsUpdateInput,
  ): Promise<Omit<KitTranslationsUpdateSuccess, 'ok'>> {
    const localesRoot = this.getLocalesRoot();
    assertSinglePathSegment('locale', input.locale);
    assertSinglePathSegment('namespace', input.namespace);
    const localeDir = this.resolveLocaleDir(localesRoot, input.locale);
    const namespacePath = this.resolveNamespaceFile(localeDir, input.namespace);

    const localeExists = await this.isDirectory(localeDir);

    if (!localeExists) {
      throw new Error(`Locale "${input.locale}" does not exist`);
    }

    if (!(await this.deps.fileExists(namespacePath))) {
      throw new Error(
        `Namespace "${input.namespace}" does not exist for locale "${input.locale}"`,
      );
    }

    const content = await this.deps.readFile(namespacePath);
    const parsed = this.parseJson(content, namespacePath);
    const keys = input.key.split('.').filter(Boolean);

    if (keys.length === 0) {
      throw new Error('Translation key must not be empty');
    }

    setNestedValue(parsed, keys, input.value);

    await this.deps.writeFile(namespacePath, JSON.stringify(parsed, null, 2));

    return {
      success: true,
      file: namespacePath,
    };
  }

  async stats(): Promise<Omit<KitTranslationsStatsSuccess, 'ok'>> {
    const { base_locale, locales, namespaces, translations } =
      await this.list();
    const baseTranslations = translations[base_locale] ?? {};
    const baseKeys = new Set<string>();

    for (const namespace of namespaces) {
      const entries = Object.keys(baseTranslations[namespace] ?? {});

      for (const key of entries) {
        baseKeys.add(`${namespace}:${key}`);
      }
    }

    const totalKeys = baseKeys.size;
    const coverage: Record<
      string,
      { total: number; translated: number; missing: number; percentage: number }
    > = {};

    for (const locale of locales) {
      let translated = 0;

      for (const compositeKey of baseKeys) {
        const [namespace, key] = compositeKey.split(':');
        const value = translations[locale]?.[namespace]?.[key];

        if (typeof value === 'string' && value.length > 0) {
          translated += 1;
        }
      }

      const missing = totalKeys - translated;
      const percentage =
        totalKeys === 0
          ? 100
          : Number(((translated / totalKeys) * 100).toFixed(1));

      coverage[locale] = {
        total: totalKeys,
        translated,
        missing,
        percentage,
      };
    }

    return {
      base_locale,
      locale_count: locales.length,
      namespace_count: namespaces.length,
      total_keys: totalKeys,
      coverage,
    };
  }

  async addNamespace(
    input: KitTranslationsAddNamespaceInput,
  ): Promise<Omit<KitTranslationsAddNamespaceSuccess, 'ok'>> {
    const localesRoot = this.getLocalesRoot();
    assertSinglePathSegment('namespace', input.namespace);

    const locales = await this.getLocaleDirectories(localesRoot);

    if (locales.length === 0) {
      throw new Error('No locales exist yet');
    }

    const filesCreated: string[] = [];

    for (const locale of locales) {
      const localeDir = this.resolveLocaleDir(localesRoot, locale);
      const namespacePath = this.resolveNamespaceFile(
        localeDir,
        input.namespace,
      );

      if (await this.deps.fileExists(namespacePath)) {
        throw new Error(`Namespace "${input.namespace}" already exists`);
      }
    }

    try {
      for (const locale of locales) {
        const localeDir = this.resolveLocaleDir(localesRoot, locale);
        const namespacePath = this.resolveNamespaceFile(
          localeDir,
          input.namespace,
        );

        await this.deps.writeFile(namespacePath, JSON.stringify({}, null, 2));
        filesCreated.push(namespacePath);
      }
    } catch (error) {
      for (const createdFile of filesCreated) {
        try {
          await this.deps.unlink(createdFile);
        } catch {
          // best-effort cleanup
        }
      }

      throw error;
    }

    return {
      success: true,
      namespace: input.namespace,
      files_created: filesCreated,
    };
  }

  async addLocale(
    input: KitTranslationsAddLocaleInput,
  ): Promise<Omit<KitTranslationsAddLocaleSuccess, 'ok'>> {
    const localesRoot = this.getLocalesRoot();
    assertSinglePathSegment('locale', input.locale);

    const localeDir = this.resolveLocaleDir(localesRoot, input.locale);

    if (await this.isDirectory(localeDir)) {
      throw new Error(`Locale "${input.locale}" already exists`);
    }

    const existingLocales = await this.getLocaleDirectories(localesRoot);
    const namespaces = new Set<string>();

    for (const locale of existingLocales) {
      const dir = this.resolveLocaleDir(localesRoot, locale);
      const files = await this.deps.readdir(dir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          namespaces.add(file.replace(/\.json$/, ''));
        }
      }
    }

    await this.deps.mkdir(localeDir);

    const filesCreated: string[] = [];

    try {
      for (const namespace of Array.from(namespaces).sort()) {
        const namespacePath = this.resolveNamespaceFile(localeDir, namespace);
        await this.deps.writeFile(namespacePath, JSON.stringify({}, null, 2));
        filesCreated.push(namespacePath);
      }
    } catch (error) {
      for (const createdFile of filesCreated) {
        try {
          await this.deps.unlink(createdFile);
        } catch {
          // best-effort cleanup
        }
      }

      try {
        await this.deps.rmdir(localeDir);
      } catch {
        // best-effort cleanup
      }

      throw error;
    }

    return {
      success: true,
      locale: input.locale,
      files_created: filesCreated,
    };
  }

  async removeNamespace(
    input: KitTranslationsRemoveNamespaceInput,
  ): Promise<Omit<KitTranslationsRemoveNamespaceSuccess, 'ok'>> {
    const localesRoot = this.getLocalesRoot();
    assertSinglePathSegment('namespace', input.namespace);

    const locales = await this.getLocaleDirectories(localesRoot);
    const filesRemoved: string[] = [];

    for (const locale of locales) {
      const localeDir = this.resolveLocaleDir(localesRoot, locale);
      const namespacePath = this.resolveNamespaceFile(
        localeDir,
        input.namespace,
      );

      if (await this.deps.fileExists(namespacePath)) {
        await this.deps.unlink(namespacePath);
        filesRemoved.push(namespacePath);
      }
    }

    if (filesRemoved.length === 0) {
      throw new Error(`Namespace "${input.namespace}" does not exist`);
    }

    return {
      success: true,
      namespace: input.namespace,
      files_removed: filesRemoved,
    };
  }

  async removeLocale(
    input: KitTranslationsRemoveLocaleInput,
  ): Promise<Omit<KitTranslationsRemoveLocaleSuccess, 'ok'>> {
    const localesRoot = this.getLocalesRoot();
    assertSinglePathSegment('locale', input.locale);

    const localeDir = this.resolveLocaleDir(localesRoot, input.locale);

    if (!(await this.isDirectory(localeDir))) {
      throw new Error(`Locale "${input.locale}" does not exist`);
    }

    const locales = await this.getLocaleDirectories(localesRoot);
    const baseLocale = locales[0];

    if (input.locale === baseLocale) {
      throw new Error(`Cannot remove base locale "${input.locale}"`);
    }

    await this.deps.rmdir(localeDir);

    return {
      success: true,
      locale: input.locale,
      path_removed: localeDir,
    };
  }

  private async getLocaleDirectories(localesRoot: string) {
    if (!(await this.deps.fileExists(localesRoot))) {
      return [];
    }

    const entries = await this.deps.readdir(localesRoot);
    const locales: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(localesRoot, entry);

      if (await this.isDirectory(fullPath)) {
        locales.push(entry);
      }
    }

    return locales.sort();
  }

  private async isDirectory(targetPath: string) {
    try {
      const stats = await this.deps.stat(targetPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  private async readFlatTranslations(filePath: string) {
    try {
      const content = await this.deps.readFile(filePath);
      const parsed = this.parseJson(content, filePath);
      return flattenTranslations(parsed);
    } catch {
      return {};
    }
  }

  private parseJson(content: string, filePath: string) {
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      throw new Error(`Invalid JSON in ${filePath}`);
    }
  }

  private resolveLocaleDir(localesRoot: string, locale: string) {
    const resolved = path.resolve(localesRoot, locale);
    return ensureInsideRoot(resolved, localesRoot, locale);
  }

  private resolveNamespaceFile(localeDir: string, namespace: string) {
    const resolved = path.resolve(localeDir, `${namespace}.json`);
    return ensureInsideRoot(resolved, localeDir, namespace);
  }

  private getLocalesRoot() {
    return path.resolve(this.deps.rootPath, 'apps', 'web', 'public', 'locales');
  }
}

function ensureInsideRoot(resolved: string, root: string, input: string) {
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (!resolved.startsWith(rootWithSep) && resolved !== root) {
    throw new Error(
      `Invalid path: "${input}" resolves outside the locales root`,
    );
  }

  return resolved;
}

function flattenTranslations(
  obj: Record<string, unknown>,
  prefix = '',
  result: Record<string, string> = {},
) {
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      result[newKey] = value;
      continue;
    }

    if (value && typeof value === 'object') {
      flattenTranslations(value as Record<string, unknown>, newKey, result);
      continue;
    }

    if (value !== undefined) {
      result[newKey] = String(value);
    }
  }

  return result;
}

function setNestedValue(
  target: Record<string, unknown>,
  keys: string[],
  value: string,
) {
  let current = target;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    const next = current[key];

    if (!next || typeof next !== 'object') {
      current[key] = {};
    }

    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]!] = value;
}

function assertSinglePathSegment(name: string, value: string) {
  if (value === '.' || value === '..') {
    throw new Error(`${name} must be a valid path segment`);
  }

  if (value.includes('..')) {
    throw new Error(`${name} must not contain ".."`);
  }

  if (value.includes('/') || value.includes('\\')) {
    throw new Error(`${name} must not include path separators`);
  }

  if (value.includes('\0')) {
    throw new Error(`${name} must not contain null bytes`);
  }
}

export function createKitTranslationsDeps(
  rootPath = process.cwd(),
): KitTranslationsDeps {
  return {
    rootPath,
    async readFile(filePath: string) {
      const fs = await import('node:fs/promises');
      return fs.readFile(filePath, 'utf8');
    },
    async writeFile(filePath: string, content: string) {
      const fs = await import('node:fs/promises');
      await fs.writeFile(filePath, content, 'utf8');
    },
    async readdir(dirPath: string) {
      const fs = await import('node:fs/promises');
      return fs.readdir(dirPath);
    },
    async stat(pathname: string) {
      const fs = await import('node:fs/promises');
      return fs.stat(pathname);
    },
    async fileExists(filePath: string) {
      const fs = await import('node:fs/promises');
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    },
    async mkdir(dirPath: string) {
      const fs = await import('node:fs/promises');
      await fs.mkdir(dirPath, { recursive: true });
    },
    async unlink(filePath: string) {
      const fs = await import('node:fs/promises');
      await fs.unlink(filePath);
    },
    async rmdir(dirPath: string) {
      const fs = await import('node:fs/promises');
      await fs.rm(dirPath, { recursive: true, force: true });
    },
  };
}
