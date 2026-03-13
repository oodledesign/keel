import type {
  KitPrerequisiteItem,
  KitPrerequisitesInput,
  KitPrerequisitesOutput,
} from './schema';

type VariantFamily = 'supabase' | 'orm';

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface ToolVersion {
  installed: boolean;
  version: string | null;
}

export interface KitPrerequisitesDeps {
  getVariantFamily(): Promise<VariantFamily>;
  executeCommand(command: string, args: string[]): Promise<CommandResult>;
}

export function createKitPrerequisitesService(deps: KitPrerequisitesDeps) {
  return new KitPrerequisitesService(deps);
}

export class KitPrerequisitesService {
  constructor(private readonly deps: KitPrerequisitesDeps) {}

  async check(_input: KitPrerequisitesInput): Promise<KitPrerequisitesOutput> {
    const family = await this.deps.getVariantFamily();

    const [node, pnpm, git, docker, supabaseCli, stripeCli] = await Promise.all(
      [
        this.getNodeVersion(),
        this.getPnpmVersion(),
        this.getGitVersion(),
        this.getDockerVersion(),
        this.getSupabaseVersion(),
        this.getStripeVersion(),
      ],
    );

    const prerequisites: KitPrerequisiteItem[] = [];

    prerequisites.push(
      this.createRequiredItem({
        id: 'node',
        name: 'Node.js',
        minimumVersion: '20.10.0',
        installUrl: 'https://nodejs.org',
        version: node,
      }),
    );

    prerequisites.push(
      this.createRequiredItem({
        id: 'pnpm',
        name: 'pnpm',
        minimumVersion: '10.0.0',
        installCommand: 'npm install -g pnpm',
        version: pnpm,
      }),
    );

    prerequisites.push(
      this.createRequiredItem({
        id: 'git',
        name: 'Git',
        minimumVersion: '2.0.0',
        installUrl: 'https://git-scm.com/downloads',
        version: git,
      }),
    );

    prerequisites.push(
      this.createRequiredItem({
        id: 'docker',
        name: 'Docker',
        minimumVersion: '20.10.0',
        installUrl: 'https://docker.com/products/docker-desktop',
        requiredFor:
          family === 'supabase' ? 'Local Supabase stack' : 'Local PostgreSQL',
        version: docker,
      }),
    );

    prerequisites.push(
      this.createVariantConditionalItem({
        id: 'supabase',
        name: 'Supabase CLI',
        minimumVersion: '2.0.0',
        installCommand: 'npm install -g supabase',
        required: family === 'supabase',
        requiredFor: 'Supabase variants',
        version: supabaseCli,
      }),
    );

    prerequisites.push(
      this.createVariantConditionalItem({
        id: 'stripe',
        name: 'Stripe CLI',
        minimumVersion: '1.0.0',
        installUrl: 'https://docs.stripe.com/stripe-cli',
        required: false,
        requiredFor: 'Payment webhook testing',
        version: stripeCli,
      }),
    );

    const overall = this.computeOverall(prerequisites);

    return {
      prerequisites,
      overall,
      ready_to_develop: overall !== 'fail',
    };
  }

  private computeOverall(items: KitPrerequisiteItem[]) {
    if (items.some((item) => item.required && item.status === 'fail')) {
      return 'fail' as const;
    }

    if (items.some((item) => item.status === 'warn')) {
      return 'warn' as const;
    }

    return 'pass' as const;
  }

  private createRequiredItem(params: {
    id: string;
    name: string;
    minimumVersion: string;
    version: ToolVersion;
    installUrl?: string;
    installCommand?: string;
    requiredFor?: string;
  }): KitPrerequisiteItem {
    const status = this.getVersionStatus(params.version, params.minimumVersion);

    return {
      id: params.id,
      name: params.name,
      required: true,
      required_for: params.requiredFor,
      installed: params.version.installed,
      version: params.version.version,
      minimum_version: params.minimumVersion,
      status,
      install_url: params.installUrl,
      install_command: params.installCommand,
      message: this.getMessage(params.version, params.minimumVersion, true),
      remedies: this.getRemedies(params, status, true),
    };
  }

  private createVariantConditionalItem(params: {
    id: string;
    name: string;
    minimumVersion: string;
    version: ToolVersion;
    required: boolean;
    requiredFor?: string;
    installUrl?: string;
    installCommand?: string;
  }): KitPrerequisiteItem {
    if (!params.required) {
      if (!params.version.installed) {
        return {
          id: params.id,
          name: params.name,
          required: false,
          required_for: params.requiredFor,
          installed: false,
          version: null,
          minimum_version: params.minimumVersion,
          status: 'warn',
          install_url: params.installUrl,
          install_command: params.installCommand,
          message: `${params.name} is optional but recommended for ${params.requiredFor ?? 'developer workflows'}.`,
          remedies: params.installCommand
            ? [params.installCommand]
            : params.installUrl
              ? [params.installUrl]
              : [],
        };
      }

      const status = this.getVersionStatus(
        params.version,
        params.minimumVersion,
      );

      return {
        id: params.id,
        name: params.name,
        required: false,
        required_for: params.requiredFor,
        installed: true,
        version: params.version.version,
        minimum_version: params.minimumVersion,
        status: status === 'fail' ? 'warn' : status,
        install_url: params.installUrl,
        install_command: params.installCommand,
        message: this.getMessage(params.version, params.minimumVersion, false),
        remedies: this.getRemedies(
          {
            ...params,
          },
          status === 'fail' ? 'warn' : status,
          false,
        ),
      };
    }

    const status = this.getVersionStatus(params.version, params.minimumVersion);

    return {
      id: params.id,
      name: params.name,
      required: true,
      required_for: params.requiredFor,
      installed: params.version.installed,
      version: params.version.version,
      minimum_version: params.minimumVersion,
      status,
      install_url: params.installUrl,
      install_command: params.installCommand,
      message: this.getMessage(params.version, params.minimumVersion, true),
      remedies: this.getRemedies(params, status, true),
    };
  }

  private getVersionStatus(version: ToolVersion, minimumVersion: string) {
    if (!version.installed || !version.version) {
      return 'fail' as const;
    }

    const cmp = compareVersions(version.version, minimumVersion);

    if (cmp < 0) {
      return 'fail' as const;
    }

    return 'pass' as const;
  }

  private getMessage(
    version: ToolVersion,
    minimumVersion: string,
    required: boolean,
  ) {
    if (!version.installed) {
      return required
        ? 'Required tool is not installed.'
        : 'Optional tool is not installed.';
    }

    if (!version.version) {
      return 'Tool is installed but version could not be detected.';
    }

    const cmp = compareVersions(version.version, minimumVersion);

    if (cmp < 0) {
      return `Installed version ${version.version} is below minimum ${minimumVersion}.`;
    }

    return `Installed version ${version.version} satisfies minimum ${minimumVersion}.`;
  }

  private getRemedies(
    params: {
      installUrl?: string;
      installCommand?: string;
      minimumVersion: string;
    },
    status: 'pass' | 'warn' | 'fail',
    required: boolean,
  ) {
    if (status === 'pass') {
      return [];
    }

    const remedies: string[] = [];

    if (params.installCommand) {
      remedies.push(params.installCommand);
    }

    if (params.installUrl) {
      remedies.push(params.installUrl);
    }

    remedies.push(`Ensure version is >= ${params.minimumVersion}`);

    if (!required && status === 'warn') {
      remedies.push(
        'Optional for development but useful for related workflows',
      );
    }

    return remedies;
  }

  private async getNodeVersion() {
    try {
      const result = await this.deps.executeCommand('node', ['--version']);
      return {
        installed: true,
        version: normalizeVersion(result.stdout),
      };
    } catch {
      return { installed: false, version: null };
    }
  }

  private async getPnpmVersion() {
    try {
      const result = await this.deps.executeCommand('pnpm', ['--version']);
      return {
        installed: true,
        version: normalizeVersion(result.stdout),
      };
    } catch {
      return { installed: false, version: null };
    }
  }

  private async getGitVersion() {
    try {
      const result = await this.deps.executeCommand('git', ['--version']);
      return {
        installed: true,
        version: normalizeVersion(result.stdout),
      };
    } catch {
      return { installed: false, version: null };
    }
  }

  private async getDockerVersion() {
    try {
      const result = await this.deps.executeCommand('docker', ['--version']);
      return {
        installed: true,
        version: normalizeVersion(result.stdout),
      };
    } catch {
      return { installed: false, version: null };
    }
  }

  private async getSupabaseVersion() {
    try {
      const result = await this.deps.executeCommand('supabase', ['--version']);
      return {
        installed: true,
        version: normalizeVersion(result.stdout),
      };
    } catch {
      return { installed: false, version: null };
    }
  }

  private async getStripeVersion() {
    try {
      const result = await this.deps.executeCommand('stripe', ['--version']);
      return {
        installed: true,
        version: normalizeVersion(result.stdout),
      };
    } catch {
      return { installed: false, version: null };
    }
  }
}

function normalizeVersion(input: string) {
  const match = input.match(/\d+\.\d+\.\d+/);

  return match ? match[0] : null;
}

function compareVersions(a: string, b: string) {
  const left = a.split('.').map((part) => Number(part));
  const right = b.split('.').map((part) => Number(part));

  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i++) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;

    if (l > r) return 1;
    if (l < r) return -1;
  }

  return 0;
}
