import fs from 'node:fs/promises';
import path from 'node:path';

import { envVariables } from './model';
import { getEnvState } from './scanner';
import type { EnvMode, ScanFs } from './types';

export interface KitEnvDeps {
  rootPath: string;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  fileExists(filePath: string): Promise<boolean>;
  readdir?(dirPath: string): Promise<string[]>;
  stat?(path: string): Promise<{ isDirectory(): boolean }>;
}

export function createKitEnvService(deps: KitEnvDeps) {
  return new KitEnvService(deps);
}

export class KitEnvService {
  constructor(private readonly deps: KitEnvDeps) {}

  async getSchema() {
    const groups = new Map<
      string,
      Array<{
        key: string;
        label: string;
        description: string;
        required: boolean;
        type: 'string' | 'url' | 'email' | 'number' | 'boolean' | 'enum';
        sensitive: boolean;
        values?: string[];
        hint?: string;
        dependencies?: Array<{ variable: string; condition: string }>;
      }>
    >();

    for (const variable of envVariables) {
      const category = variable.category;

      if (!groups.has(category)) {
        groups.set(category, []);
      }

      groups.get(category)!.push({
        key: variable.name,
        label: variable.displayName,
        description: variable.description,
        required: variable.required ?? false,
        type: mapType(variable.type),
        sensitive: variable.secret ?? false,
        values: variable.values?.filter(
          (v): v is string => typeof v === 'string',
        ),
        hint: variable.hint,
        dependencies: variable.contextualValidation?.dependencies.map(
          (dep) => ({
            variable: dep.variable,
            condition: dep.message,
          }),
        ),
      });
    }

    return {
      groups: Array.from(groups.entries()).map(([name, variables]) => ({
        name,
        description: `${name} configuration`,
        variables,
      })),
    };
  }

  async read(mode: EnvMode) {
    const scanFs = this.getScanFs();
    const states = await getEnvState({
      mode,
      apps: ['web'],
      rootDir: this.deps.rootPath,
      fs: scanFs,
    });

    const webState = states.find((state) => state.appName === 'web');

    if (!webState) {
      return {
        mode,
        variables: {},
      };
    }

    const allVariables = Object.values(webState.variables).reduce(
      (acc, variable) => {
        acc[variable.key] = variable.effectiveValue;
        return acc;
      },
      {} as Record<string, string>,
    );

    const variables = Object.fromEntries(
      Object.entries(webState.variables).map(([key, variable]) => {
        const model = envVariables.find((item) => item.name === key);

        return [
          key,
          {
            key,
            value: variable.effectiveValue,
            source: variable.effectiveSource,
            isOverridden: variable.isOverridden,
            overrideChain:
              variable.definitions.length > 1
                ? variable.definitions.map((definition) => ({
                    source: definition.source,
                    value: definition.value,
                  }))
                : undefined,
            validation: {
              valid: variable.validation.success,
              errors: variable.validation.error.issues,
            },
            dependencies: model?.contextualValidation?.dependencies.map(
              (dep) => {
                const dependencyValue = allVariables[dep.variable] ?? '';
                const satisfied = dep.condition(dependencyValue, allVariables);

                return {
                  variable: dep.variable,
                  condition: dep.message,
                  satisfied,
                };
              },
            ),
          },
        ];
      }),
    );

    return {
      mode,
      variables,
    };
  }

  async update(input: {
    key?: string;
    value?: string;
    file?: string;
    mode?: EnvMode;
  }) {
    if (!input.key || typeof input.value !== 'string') {
      throw new Error('Both key and value are required for kit_env_update');
    }

    const fileName =
      input.file ??
      this.resolveDefaultFile(input.key, input.mode ?? 'development');
    const targetPath = this.resolveWebFile(fileName);

    let content = '';

    if (await this.deps.fileExists(targetPath)) {
      content = await this.deps.readFile(targetPath);
    }

    const lines = content.length > 0 ? content.split('\n') : [];

    let replaced = false;
    const updatedLines = lines.map((line) => {
      if (line.startsWith(`${input.key}=`)) {
        replaced = true;
        return `${input.key}=${input.value}`;
      }

      return line;
    });

    if (!replaced) {
      if (
        updatedLines.length > 0 &&
        updatedLines[updatedLines.length - 1] !== ''
      ) {
        updatedLines.push('');
      }

      updatedLines.push(`${input.key}=${input.value}`);
    }

    await this.deps.writeFile(targetPath, updatedLines.join('\n'));

    return {
      success: true,
      message: `Updated ${input.key} in ${fileName}`,
    };
  }

  async rawRead(file: string) {
    const targetPath = this.resolveWebFile(file);

    if (!(await this.deps.fileExists(targetPath))) {
      return {
        content: '',
        exists: false,
      };
    }

    return {
      content: await this.deps.readFile(targetPath),
      exists: true,
    };
  }

  async rawWrite(file: string, content: string) {
    const targetPath = this.resolveWebFile(file);
    await this.deps.writeFile(targetPath, content);

    return {
      success: true,
      message: `Saved ${file}`,
    };
  }

  async getVariable(key: string, mode: EnvMode) {
    const result = await this.read(mode);
    return result.variables[key]?.value ?? '';
  }

  async getAppState(mode: EnvMode) {
    const scanFs = this.getScanFs();
    const states = await getEnvState({
      mode,
      apps: ['web'],
      rootDir: this.deps.rootPath,
      fs: scanFs,
    });

    return states;
  }

  private resolveDefaultFile(key: string, mode: EnvMode) {
    const model = envVariables.find((item) => item.name === key);
    const isSecret = model?.secret ?? true;

    if (mode === 'production') {
      return isSecret ? '.env.production.local' : '.env.production';
    }

    return isSecret ? '.env.local' : '.env.development';
  }

  private resolveWebFile(fileName: string) {
    const webDir = path.resolve(this.deps.rootPath, 'apps', 'web');
    const resolved = path.resolve(webDir, fileName);

    // Prevent path traversal outside the web app directory
    if (!resolved.startsWith(webDir + path.sep) && resolved !== webDir) {
      throw new Error(
        `Invalid file path: "${fileName}" resolves outside the web app directory`,
      );
    }

    return resolved;
  }

  private getScanFs(): ScanFs | undefined {
    if (!this.deps.readdir || !this.deps.stat) {
      return undefined;
    }

    return {
      readFile: (filePath) => this.deps.readFile(filePath),
      readdir: (dirPath) => this.deps.readdir!(dirPath),
      stat: (path) => this.deps.stat!(path),
    };
  }
}

function mapType(
  type?: string,
): 'string' | 'url' | 'email' | 'number' | 'boolean' | 'enum' {
  if (
    type === 'url' ||
    type === 'email' ||
    type === 'number' ||
    type === 'boolean' ||
    type === 'enum'
  ) {
    return type;
  }

  return 'string';
}

export function createKitEnvDeps(rootPath = process.cwd()): KitEnvDeps {
  return {
    rootPath,
    readFile(filePath: string) {
      return fs.readFile(filePath, 'utf8');
    },
    writeFile(filePath: string, content: string) {
      return fs.writeFile(filePath, content, 'utf8');
    },
    readdir(dirPath: string) {
      return fs.readdir(dirPath);
    },
    stat(path: string) {
      return fs.stat(path);
    },
    async fileExists(filePath: string) {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    },
  };
}
