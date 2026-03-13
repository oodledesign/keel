import { join } from 'node:path';

import type { KitStatusInput, KitStatusOutput } from './schema';

interface VariantDescriptor {
  variant: string;
  variant_family: string;
  framework: string;
  database: string;
  auth: string;
}

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface ServicesStatus {
  app: {
    running: boolean;
    port: number | null;
  };
  supabase: {
    running: boolean;
    api_port: number | null;
    studio_port: number | null;
  };
}

interface MergeCheckStatus {
  target_branch: string | null;
  detectable: boolean;
  has_conflicts: boolean | null;
  conflict_files: string[];
  message: string;
}

export interface KitStatusDeps {
  rootPath: string;
  readJsonFile(path: string): Promise<unknown>;
  pathExists(path: string): Promise<boolean>;
  isDirectory(path: string): Promise<boolean>;
  executeCommand(command: string, args: string[]): Promise<CommandResult>;
  isPortOpen(port: number): Promise<boolean>;
  getNodeVersion(): string;
}

export function createKitStatusService(deps: KitStatusDeps) {
  return new KitStatusService(deps);
}

export class KitStatusService {
  constructor(private readonly deps: KitStatusDeps) {}

  async getStatus(_input: KitStatusInput): Promise<KitStatusOutput> {
    const packageJson = await this.readObject('package.json');

    const projectName = this.readString(packageJson, 'name') ?? 'unknown';
    const packageManager = this.getPackageManager(packageJson);
    const depsInstalled = await this.deps.isDirectory('node_modules');

    const { gitBranch, gitClean, modifiedFiles, untrackedFiles, mergeCheck } =
      await this.getGitStatus();
    const variant = await this.resolveVariant();
    const services = await this.getServicesStatus();
    const diagnostics = this.buildDiagnostics({
      depsInstalled,
      gitBranch,
      gitClean,
      mergeCheck,
      services,
    });

    return {
      ...variant,
      project_name: projectName,
      node_version: this.deps.getNodeVersion().replace(/^v/, ''),
      package_manager: packageManager,
      deps_installed: depsInstalled,
      git_clean: gitClean,
      git_branch: gitBranch,
      git_modified_files: modifiedFiles,
      git_untracked_files: untrackedFiles,
      git_merge_check: mergeCheck,
      services,
      diagnostics,
    };
  }

  private async getServicesStatus(): Promise<ServicesStatus> {
    const app = await this.detectAppService();
    const supabase = await this.detectSupabaseService();

    return {
      app,
      supabase,
    };
  }

  private async detectAppService() {
    const commonDevPorts = [3000, 3001, 3002, 3003];

    for (const port of commonDevPorts) {
      if (await this.deps.isPortOpen(port)) {
        return {
          running: true,
          port,
        };
      }
    }

    return {
      running: false,
      port: null,
    };
  }

  private async detectSupabaseService() {
    const apiPort = 54321;
    const studioPort = 54323;

    const [apiRunning, studioRunning] = await Promise.all([
      this.deps.isPortOpen(apiPort),
      this.deps.isPortOpen(studioPort),
    ]);

    return {
      running: apiRunning || studioRunning,
      api_port: apiRunning ? apiPort : null,
      studio_port: studioRunning ? studioPort : null,
    };
  }

  private buildDiagnostics(params: {
    depsInstalled: boolean;
    gitBranch: string;
    gitClean: boolean;
    mergeCheck: MergeCheckStatus;
    services: ServicesStatus;
  }) {
    const diagnostics: KitStatusOutput['diagnostics'] = [];

    diagnostics.push({
      id: 'dependencies',
      status: params.depsInstalled ? 'pass' : 'fail',
      message: params.depsInstalled
        ? 'Dependencies are installed.'
        : 'Dependencies are missing.',
      remedies: params.depsInstalled ? [] : ['Run pnpm install'],
    });

    diagnostics.push({
      id: 'dev_server',
      status: params.services.app.running ? 'pass' : 'fail',
      message: params.services.app.running
        ? `Dev server is running on port ${params.services.app.port}.`
        : 'Dev server is not running.',
      remedies: params.services.app.running ? [] : ['Run pnpm dev'],
    });

    diagnostics.push({
      id: 'supabase',
      status: params.services.supabase.running ? 'pass' : 'fail',
      message: params.services.supabase.running
        ? `Supabase is running${params.services.supabase.api_port ? ` (API ${params.services.supabase.api_port})` : ''}${params.services.supabase.studio_port ? ` (Studio ${params.services.supabase.studio_port})` : ''}.`
        : 'Supabase is not running.',
      remedies: params.services.supabase.running
        ? []
        : ['Run pnpm supabase:web:start'],
    });

    diagnostics.push({
      id: 'git',
      status:
        params.gitBranch === 'unknown'
          ? 'warn'
          : params.gitClean
            ? 'pass'
            : 'warn',
      message:
        params.gitBranch === 'unknown'
          ? 'Git status unavailable.'
          : `Current branch ${params.gitBranch} is ${params.gitClean ? 'clean' : 'dirty'}.`,
      remedies:
        params.gitBranch === 'unknown' || params.gitClean
          ? []
          : ['Commit or stash changes when you need a clean workspace'],
    });

    diagnostics.push({
      id: 'merge_conflicts',
      status:
        params.mergeCheck.has_conflicts === true
          ? 'warn'
          : params.mergeCheck.detectable
            ? 'pass'
            : 'warn',
      message: params.mergeCheck.message,
      remedies:
        params.mergeCheck.has_conflicts === true
          ? [
              `Rebase or merge ${params.mergeCheck.target_branch} and resolve conflicts`,
            ]
          : [],
    });

    return diagnostics;
  }

  private async getGitStatus() {
    try {
      const branchResult = await this.deps.executeCommand('git', [
        'rev-parse',
        '--abbrev-ref',
        'HEAD',
      ]);

      const statusResult = await this.deps.executeCommand('git', [
        'status',
        '--porcelain',
      ]);

      const parsedStatus = this.parseGitStatus(statusResult.stdout);
      const mergeCheck = await this.getMergeCheck();

      return {
        gitBranch: branchResult.stdout.trim() || 'unknown',
        gitClean:
          parsedStatus.modifiedFiles.length === 0 &&
          parsedStatus.untrackedFiles.length === 0,
        modifiedFiles: parsedStatus.modifiedFiles,
        untrackedFiles: parsedStatus.untrackedFiles,
        mergeCheck,
      };
    } catch {
      return {
        gitBranch: 'unknown',
        gitClean: false,
        modifiedFiles: [],
        untrackedFiles: [],
        mergeCheck: {
          target_branch: null,
          detectable: false,
          has_conflicts: null,
          conflict_files: [],
          message: 'Git metadata unavailable.',
        } satisfies MergeCheckStatus,
      };
    }
  }

  private parseGitStatus(output: string) {
    const modifiedFiles: string[] = [];
    const untrackedFiles: string[] = [];

    const lines = output.split('\n').filter((line) => line.trim().length > 0);

    for (const line of lines) {
      if (line.startsWith('?? ')) {
        const path = line.slice(3).trim();
        if (path) {
          untrackedFiles.push(path);
        }

        continue;
      }

      if (line.length >= 4) {
        const path = line.slice(3).trim();
        if (path) {
          modifiedFiles.push(path);
        }
      }
    }

    return {
      modifiedFiles,
      untrackedFiles,
    };
  }

  private async getMergeCheck(): Promise<MergeCheckStatus> {
    const targetBranch = await this.resolveMergeTargetBranch();

    if (!targetBranch) {
      return {
        target_branch: null,
        detectable: false,
        has_conflicts: null,
        conflict_files: [],
        message: 'No default target branch found for merge conflict checks.',
      };
    }

    try {
      const mergeBaseResult = await this.deps.executeCommand('git', [
        'merge-base',
        'HEAD',
        targetBranch,
      ]);

      const mergeBase = mergeBaseResult.stdout.trim();

      if (!mergeBase) {
        return {
          target_branch: targetBranch,
          detectable: false,
          has_conflicts: null,
          conflict_files: [],
          message: 'Unable to compute merge base.',
        };
      }

      const mergeTreeResult = await this.deps.executeCommand('git', [
        'merge-tree',
        mergeBase,
        'HEAD',
        targetBranch,
      ]);

      const rawOutput = `${mergeTreeResult.stdout}\n${mergeTreeResult.stderr}`;
      const conflictFiles = this.extractConflictFiles(rawOutput);
      const hasConflictMarkers =
        /CONFLICT|changed in both|both modified|both added/i.test(rawOutput);
      const hasConflicts = conflictFiles.length > 0 || hasConflictMarkers;

      return {
        target_branch: targetBranch,
        detectable: true,
        has_conflicts: hasConflicts,
        conflict_files: conflictFiles,
        message: hasConflicts
          ? `Potential merge conflicts detected against ${targetBranch}.`
          : `No merge conflicts detected against ${targetBranch}.`,
      };
    } catch {
      return {
        target_branch: targetBranch,
        detectable: false,
        has_conflicts: null,
        conflict_files: [],
        message: 'Merge conflict detection is not available in this git setup.',
      };
    }
  }

  private extractConflictFiles(rawOutput: string) {
    const files = new Set<string>();
    const lines = rawOutput.split('\n');

    for (const line of lines) {
      const conflictMatch = line.match(/CONFLICT .* in (.+)$/);
      if (conflictMatch?.[1]) {
        files.add(conflictMatch[1].trim());
      }
    }

    return Array.from(files).sort((a, b) => a.localeCompare(b));
  }

  private async resolveMergeTargetBranch() {
    try {
      const originHead = await this.deps.executeCommand('git', [
        'symbolic-ref',
        '--quiet',
        '--short',
        'refs/remotes/origin/HEAD',
      ]);

      const value = originHead.stdout.trim();
      if (value) {
        return value.replace(/^origin\//, '');
      }
    } catch {
      // Fallback candidates below.
    }

    for (const candidate of ['main', 'master']) {
      try {
        await this.deps.executeCommand('git', [
          'rev-parse',
          '--verify',
          candidate,
        ]);
        return candidate;
      } catch {
        // Try next.
      }
    }

    return null;
  }

  private async resolveVariant(): Promise<VariantDescriptor> {
    const explicitVariant = await this.resolveConfiguredVariant();

    if (explicitVariant) {
      return explicitVariant;
    }

    const heuristicVariant = await this.resolveHeuristicVariant();

    if (heuristicVariant) {
      return heuristicVariant;
    }

    return this.mapVariant('next-supabase');
  }

  private async resolveConfiguredVariant(): Promise<VariantDescriptor | null> {
    const configPath = '.makerkit/config.json';

    if (!(await this.deps.pathExists(configPath))) {
      return null;
    }

    const config = await this.readObject(configPath);

    const value =
      this.readString(config, 'variant') ??
      this.readString(config, 'template') ??
      this.readString(config, 'kitVariant');

    if (!value) {
      return null;
    }

    return this.mapVariant(value, {
      preserveVariant: true,
    });
  }

  private async resolveHeuristicVariant(): Promise<VariantDescriptor | null> {
    const hasSupabaseFolder = await this.deps.pathExists('apps/web/supabase');

    if (!hasSupabaseFolder) {
      return null;
    }

    const appPackage = await this.readObject(
      join('apps', 'web', 'package.json'),
    );

    const hasNextDependency = this.hasDependency(appPackage, 'next');

    if (hasNextDependency) {
      return this.mapVariant('next-supabase');
    }

    return null;
  }

  private hasDependency(json: Record<string, unknown>, dependency: string) {
    const dependencies = this.readObjectValue(json, 'dependencies');
    const devDependencies = this.readObjectValue(json, 'devDependencies');

    return Boolean(
      this.readString(dependencies, dependency) ||
      this.readString(devDependencies, dependency),
    );
  }

  private mapVariant(
    variant: string,
    options: {
      preserveVariant?: boolean;
    } = {},
  ): VariantDescriptor {
    if (variant === 'next-drizzle') {
      return {
        variant,
        variant_family: 'orm',
        framework: 'nextjs',
        database: 'postgresql',
        auth: 'better-auth',
      };
    }

    if (variant === 'next-prisma') {
      return {
        variant,
        variant_family: 'orm',
        framework: 'nextjs',
        database: 'postgresql',
        auth: 'better-auth',
      };
    }

    if (variant === 'react-router-supabase') {
      return {
        variant,
        variant_family: 'supabase',
        framework: 'react-router',
        database: 'supabase',
        auth: 'supabase',
      };
    }

    return {
      variant: options.preserveVariant ? variant : 'next-supabase',
      variant_family: 'supabase',
      framework: 'nextjs',
      database: 'supabase',
      auth: 'supabase',
    };
  }

  private async readObject(path: string): Promise<Record<string, unknown>> {
    try {
      const value = await this.deps.readJsonFile(path);

      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
      }

      return value as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private readString(obj: Record<string, unknown>, key: string) {
    const value = obj[key];

    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private readObjectValue(obj: Record<string, unknown>, key: string) {
    const value = obj[key];

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private getPackageManager(packageJson: Record<string, unknown>) {
    const packageManager = this.readString(packageJson, 'packageManager');

    if (!packageManager) {
      return 'unknown';
    }

    const [name] = packageManager.split('@');
    return name || 'unknown';
  }
}
