import path from 'node:path';

import { EMAIL_TEMPLATE_RENDERERS } from '@kit/email-templates/registry';

import type { KitEmailsListOutput, KitEmailsReadOutput } from './schema';

export interface KitEmailsDeps {
  rootPath: string;
  readFile(filePath: string): Promise<string>;
  readdir(dirPath: string): Promise<string[]>;
  fileExists(filePath: string): Promise<boolean>;
  renderReactEmail(
    sampleProps: Record<string, string>,
    templateId: string,
  ): Promise<string | null>;
}

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  file: string;
  description: string;
}

export function createKitEmailsService(deps: KitEmailsDeps) {
  return new KitEmailsService(deps);
}

export class KitEmailsService {
  constructor(private readonly deps: KitEmailsDeps) {}

  async list(): Promise<KitEmailsListOutput> {
    const templates: EmailTemplate[] = [];

    const reactTemplates = await this.discoverReactEmailTemplates();
    const supabaseTemplates = await this.discoverSupabaseAuthTemplates();

    templates.push(...reactTemplates, ...supabaseTemplates);

    const categories = [...new Set(templates.map((t) => t.category))].sort();

    return {
      templates,
      categories,
      total: templates.length,
    };
  }

  async read(input: { id: string }): Promise<KitEmailsReadOutput> {
    assertSafeId(input.id);

    const { templates } = await this.list();
    const template = templates.find((t) => t.id === input.id);

    if (!template) {
      throw new Error(`Email template not found: "${input.id}"`);
    }

    const absolutePath = path.resolve(this.deps.rootPath, template.file);
    ensureInsideRoot(absolutePath, this.deps.rootPath, input.id);

    const source = await this.deps.readFile(absolutePath);
    const isReactEmail = absolutePath.includes('packages/email-templates');
    const props = isReactEmail ? extractPropsFromSource(source) : [];

    let renderedHtml: string | null = null;

    if (isReactEmail) {
      const sampleProps = buildSampleProps(props);

      renderedHtml = await this.deps.renderReactEmail(sampleProps, template.id);
    }

    return {
      id: template.id,
      name: template.name,
      category: template.category,
      file: template.file,
      source,
      props,
      renderedHtml,
    };
  }

  private async discoverReactEmailTemplates(): Promise<EmailTemplate[]> {
    const dir = path.join('packages', 'email-templates', 'src', 'emails');

    const absoluteDir = path.resolve(this.deps.rootPath, dir);

    if (!(await this.deps.fileExists(absoluteDir))) {
      return [];
    }

    const files = await this.deps.readdir(absoluteDir);
    const templates: EmailTemplate[] = [];

    for (const file of files) {
      if (!file.endsWith('.email.tsx')) {
        continue;
      }

      const stem = file.replace(/\.email\.tsx$/, '');
      const id = `${stem}-email`;
      const name = humanize(stem);

      templates.push({
        id,
        name,
        category: 'transactional',
        file: path.join(dir, file),
        description: `${name} transactional email template`,
      });
    }

    return templates.sort((a, b) => a.id.localeCompare(b.id));
  }

  private async discoverSupabaseAuthTemplates(): Promise<EmailTemplate[]> {
    const dir = path.join('apps', 'web', 'supabase', 'templates');

    const absoluteDir = path.resolve(this.deps.rootPath, dir);

    if (!(await this.deps.fileExists(absoluteDir))) {
      return [];
    }

    const files = await this.deps.readdir(absoluteDir);
    const templates: EmailTemplate[] = [];

    for (const file of files) {
      if (!file.endsWith('.html')) {
        continue;
      }

      const id = file.replace(/\.html$/, '');
      const name = humanize(id);

      templates.push({
        id,
        name,
        category: 'supabase-auth',
        file: path.join(dir, file),
        description: `${name} Supabase auth email template`,
      });
    }

    return templates.sort((a, b) => a.id.localeCompare(b.id));
  }
}

function humanize(kebab: string): string {
  return kebab
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function extractPropsFromSource(
  source: string,
): Array<{ name: string; type: string; required: boolean }> {
  const interfaceMatch = source.match(/interface\s+Props\s*\{([^}]*)\}/);

  if (!interfaceMatch?.[1]) {
    return [];
  }

  const body = interfaceMatch[1];
  const props: Array<{ name: string; type: string; required: boolean }> = [];

  const propRegex = /(\w+)(\??):\s*([^;\n]+)/g;
  let match: RegExpExecArray | null;

  while ((match = propRegex.exec(body)) !== null) {
    const name = match[1]!;
    const optional = match[2] === '?';
    const type = match[3]!.trim();

    props.push({
      name,
      type,
      required: !optional,
    });
  }

  return props;
}

function ensureInsideRoot(resolved: string, root: string, input: string) {
  const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (!resolved.startsWith(normalizedRoot) && resolved !== root) {
    throw new Error(
      `Invalid path: "${input}" resolves outside the project root`,
    );
  }

  return resolved;
}

function buildSampleProps(
  props: Array<{ name: string; type: string; required: boolean }>,
): Record<string, string> {
  const sample: Record<string, string> = {};

  for (const prop of props) {
    if (prop.name === 'language') continue;

    sample[prop.name] = SAMPLE_PROP_VALUES[prop.name] ?? `Sample ${prop.name}`;
  }

  return sample;
}

const SAMPLE_PROP_VALUES: Record<string, string> = {
  productName: 'Makerkit',
  teamName: 'Acme Team',
  inviter: 'John Doe',
  invitedUserEmail: 'user@example.com',
  link: 'https://example.com/action',
  otp: '123456',
  email: 'user@example.com',
  name: 'Jane Doe',
  userName: 'Jane Doe',
};

function assertSafeId(id: string) {
  if (id.includes('..')) {
    throw new Error('Template id must not contain ".."');
  }

  if (id.includes('/') || id.includes('\\')) {
    throw new Error('Template id must not include path separators');
  }
}

export function createKitEmailsDeps(rootPath = process.cwd()): KitEmailsDeps {
  return {
    rootPath,
    async readFile(filePath: string) {
      const fs = await import('node:fs/promises');
      return fs.readFile(filePath, 'utf8');
    },
    async readdir(dirPath: string) {
      const fs = await import('node:fs/promises');
      return fs.readdir(dirPath);
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
    async renderReactEmail(
      sampleProps: Record<string, string>,
      templateId?: string,
    ) {
      const renderFromRegistry =
        typeof templateId === 'string'
          ? EMAIL_TEMPLATE_RENDERERS?.[templateId]
          : undefined;

      if (typeof renderFromRegistry === 'function') {
        const result = await renderFromRegistry(sampleProps);

        if (typeof result === 'string') {
          return result;
        }

        if (
          typeof result === 'object' &&
          result !== null &&
          'html' in result &&
          typeof (result as { html: unknown }).html === 'string'
        ) {
          return (result as { html: string }).html;
        }

        return null;
      }

      throw new Error(`Email template renderer not found: "${templateId}"`);
    },
  };
}
