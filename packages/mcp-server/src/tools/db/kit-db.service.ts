import { join } from 'node:path';

import type {
  DbTool,
  KitDbMigrateInput,
  KitDbMigrateOutput,
  KitDbResetInput,
  KitDbResetOutput,
  KitDbSeedOutput,
  KitDbStatusOutput,
} from './schema';

type VariantFamily = 'supabase' | 'orm';

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface VariantContext {
  variant: string;
  variantFamily: VariantFamily;
  tool: DbTool;
}

interface MigrationStatus {
  applied: string[];
  pending: string[];
}

interface SeedScript {
  command: string;
  args: string[];
}

export interface KitDbServiceDeps {
  rootPath: string;
  resolveVariantContext(): Promise<VariantContext>;
  executeCommand(command: string, args: string[]): Promise<CommandResult>;
  isPortOpen(port: number): Promise<boolean>;
  fileExists(path: string): Promise<boolean>;
  readdir(path: string): Promise<string[]>;
  readJsonFile(path: string): Promise<unknown>;
}

const SUPABASE_PORT = 54321;
const ORM_PORT = 5432;

export function createKitDbService(deps: KitDbServiceDeps) {
  return new KitDbService(deps);
}

export class KitDbService {
  constructor(private readonly deps: KitDbServiceDeps) {}

  async status(): Promise<KitDbStatusOutput> {
    const variant = await this.deps.resolveVariantContext();
    const connected = await this.isConnected(variant);
    const migrations = await this.getMigrationSummary(variant, {
      connected,
    });

    return {
      connected,
      tool: variant.tool,
      migrations: {
        applied: migrations.applied.length,
        pending: migrations.pending.length,
        pending_names: migrations.pending,
      },
    };
  }

  async migrate(input: KitDbMigrateInput): Promise<KitDbMigrateOutput> {
    const variant = await this.deps.resolveVariantContext();

    if (input.target !== 'latest') {
      throw new Error(
        `Specific migration targets are not supported for ${variant.tool} in this kit. Use target "latest".`,
      );
    }

    const pending = await this.getPendingMigrationNames(variant);

    await this.runMigrations(variant);

    return {
      applied: pending,
      total_applied: pending.length,
      status: 'success',
    };
  }

  async seed(): Promise<KitDbSeedOutput> {
    const variant = await this.deps.resolveVariantContext();
    const seedScript = await this.resolveSeedScript(variant);

    await this.deps.executeCommand(seedScript.command, seedScript.args);

    return {
      status: 'success',
      message: 'Seed data applied successfully',
    };
  }

  async reset(input: KitDbResetInput): Promise<KitDbResetOutput> {
    if (!input.confirm) {
      throw new Error('Database reset requires confirm: true');
    }

    const variant = await this.deps.resolveVariantContext();

    if (variant.variantFamily === 'supabase') {
      await this.deps.executeCommand('supabase', ['db', 'reset']);
    } else {
      await this.deps.executeCommand('docker', ['compose', 'down', '-v']);
      await this.deps.executeCommand('docker', [
        'compose',
        'up',
        '-d',
        'postgres',
      ]);
      await this.runMigrations(variant);
    }

    return {
      status: 'success',
      message: 'Database reset and migrations re-applied',
    };
  }

  private async isConnected(variant: VariantContext) {
    const port =
      variant.variantFamily === 'supabase' ? SUPABASE_PORT : ORM_PORT;
    return this.deps.isPortOpen(port);
  }

  private async getMigrationSummary(
    variant: VariantContext,
    options: {
      connected?: boolean;
    } = {},
  ): Promise<MigrationStatus> {
    const localMigrations = await this.listLocalMigrations(variant);

    if (variant.variantFamily === 'supabase') {
      const parsed = await this.tryParseSupabaseMigrations(localMigrations);
      if (parsed) {
        return parsed;
      }
    }

    if (
      variant.variantFamily === 'supabase' &&
      options.connected &&
      localMigrations.length > 0
    ) {
      return {
        applied: localMigrations,
        pending: [],
      };
    }

    return {
      applied: [],
      pending: localMigrations,
    };
  }

  private async getPendingMigrationNames(variant: VariantContext) {
    const summary = await this.getMigrationSummary(variant);
    return summary.pending;
  }

  private async runMigrations(variant: VariantContext) {
    if (variant.tool === 'supabase') {
      await this.deps.executeCommand('supabase', ['db', 'push']);
      return;
    }

    if (variant.tool === 'drizzle-kit') {
      await this.deps.executeCommand('drizzle-kit', ['push']);
      return;
    }

    await this.deps.executeCommand('prisma', ['db', 'push']);
  }

  private async resolveSeedScript(
    variant: VariantContext,
  ): Promise<SeedScript> {
    const customScript = await this.findSeedScript();

    if (customScript) {
      return {
        command: 'pnpm',
        args: ['--filter', 'web', 'run', customScript],
      };
    }

    if (variant.tool === 'supabase') {
      return {
        command: 'supabase',
        args: ['db', 'seed'],
      };
    }

    if (variant.tool === 'prisma') {
      return {
        command: 'prisma',
        args: ['db', 'seed'],
      };
    }

    throw new Error(
      'No seed command configured. Add a db:seed or seed script to apps/web/package.json.',
    );
  }

  private async findSeedScript() {
    const packageJsonPath = join(
      this.deps.rootPath,
      'apps',
      'web',
      'package.json',
    );

    const packageJson = await this.readObject(packageJsonPath);
    const scripts = this.readObjectValue(packageJson, 'scripts');

    if (this.readString(scripts, 'db:seed')) {
      return 'db:seed';
    }

    if (this.readString(scripts, 'seed')) {
      return 'seed';
    }

    return null;
  }

  private async listLocalMigrations(variant: VariantContext) {
    const migrationsDir = await this.resolveMigrationsDir(variant);

    if (!migrationsDir) {
      return [];
    }

    const entries = await this.deps.readdir(migrationsDir);
    return this.filterMigrationNames(variant, entries);
  }

  private async resolveMigrationsDir(variant: VariantContext) {
    if (variant.tool === 'supabase') {
      const supabaseDir = join(
        this.deps.rootPath,
        'apps',
        'web',
        'supabase',
        'migrations',
      );
      return (await this.deps.fileExists(supabaseDir)) ? supabaseDir : null;
    }

    if (variant.tool === 'prisma') {
      const prismaDir = join(
        this.deps.rootPath,
        'apps',
        'web',
        'prisma',
        'migrations',
      );
      return (await this.deps.fileExists(prismaDir)) ? prismaDir : null;
    }

    const drizzleDir = join(
      this.deps.rootPath,
      'apps',
      'web',
      'drizzle',
      'migrations',
    );

    if (await this.deps.fileExists(drizzleDir)) {
      return drizzleDir;
    }

    const fallbackDir = join(this.deps.rootPath, 'drizzle', 'migrations');
    return (await this.deps.fileExists(fallbackDir)) ? fallbackDir : null;
  }

  private filterMigrationNames(variant: VariantContext, entries: string[]) {
    if (variant.tool === 'prisma') {
      return entries.filter((entry) => entry.trim().length > 0);
    }

    return entries
      .filter((entry) => entry.endsWith('.sql'))
      .map((entry) => entry.replace(/\.sql$/, ''));
  }

  private async tryParseSupabaseMigrations(localMigrations: string[]) {
    try {
      const localResult = await this.deps.executeCommand('supabase', [
        'migrations',
        'list',
        '--local',
      ]);
      const parsedLocal = parseSupabaseMigrationsList(
        localResult.stdout,
        localMigrations,
      );
      if (parsedLocal) {
        return parsedLocal;
      }
    } catch {
      // Fall through to remote attempt.
    }

    try {
      const remoteResult = await this.deps.executeCommand('supabase', [
        'migrations',
        'list',
      ]);
      return parseSupabaseMigrationsList(remoteResult.stdout, localMigrations);
    } catch {
      return null;
    }
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

  private readObjectValue(obj: Record<string, unknown>, key: string) {
    const value = obj[key];

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private readString(obj: Record<string, unknown>, key: string) {
    const value = obj[key];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
}

function parseSupabaseMigrationsList(
  output: string,
  localMigrations: string[],
): MigrationStatus | null {
  const applied = new Set<string>();
  const pending = new Set<string>();
  const appliedCandidates = new Set<string>();
  const lines = output.split('\n');
  const migrationsById = buildMigrationIdMap(localMigrations);
  let sawStatus = false;
  let sawId = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const status = extractSupabaseStatus(trimmed);
    const nameFromLine = extractMigrationName(
      trimmed,
      localMigrations,
      migrationsById,
    );

    if (nameFromLine) {
      sawId = true;
    }

    if (!status) {
      if (nameFromLine) {
        appliedCandidates.add(nameFromLine);
      }
      continue;
    }

    sawStatus = true;

    if (!nameFromLine) {
      continue;
    }

    if (status === 'applied') {
      applied.add(nameFromLine);
    } else {
      pending.add(nameFromLine);
    }
  }

  if (!sawStatus && sawId && appliedCandidates.size > 0) {
    const appliedList = Array.from(appliedCandidates);
    const pendingList = localMigrations.filter(
      (migration) => !appliedCandidates.has(migration),
    );

    return {
      applied: appliedList,
      pending: pendingList,
    };
  }

  if (applied.size === 0 && pending.size === 0) {
    return null;
  }

  return {
    applied: Array.from(applied),
    pending: Array.from(pending),
  };
}

function extractMigrationName(
  line: string,
  candidates: string[],
  migrationsById: Map<string, string>,
) {
  const directMatch = line.match(/\b\d{14}_[a-z0-9_]+\b/i);
  if (directMatch?.[0]) {
    return directMatch[0];
  }

  const columns = line
    .split('|')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (columns.length >= 2) {
    const id = columns.find((value) => /^\d{14}$/.test(value));
    if (id) {
      const byId = migrationsById.get(id);
      if (byId) {
        return byId;
      }

      const nameColumn = columns[1];
      const normalizedName = normalizeMigrationName(nameColumn);
      const candidate = `${id}_${normalizedName}`;
      const exactMatch = candidates.find(
        (migration) =>
          migration.toLowerCase() === candidate.toLowerCase() ||
          normalizeMigrationName(migration) === normalizedName,
      );

      return exactMatch ?? candidate;
    }
  }

  return candidates.find((name) => line.includes(name)) ?? null;
}

function extractSupabaseStatus(line: string) {
  const lower = line.toLowerCase();

  if (/\b(not applied|pending|missing)\b/.test(lower)) {
    return 'pending';
  }

  if (/\b(applied|completed)\b/.test(lower)) {
    return 'applied';
  }

  return null;
}

function buildMigrationIdMap(migrations: string[]) {
  const map = new Map<string, string>();

  for (const migration of migrations) {
    const match = migration.match(/^(\d{14})_(.+)$/);
    if (match?.[1]) {
      map.set(match[1], migration);
    }
  }

  return map;
}

function normalizeMigrationName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
}
