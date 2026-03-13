import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod/v3';

export class MigrationsTool {
  static GetMigrations() {
    return readdir(
      join(process.cwd(), 'apps', 'web', 'supabase', 'migrations'),
    );
  }

  static getMigrationContent(path: string) {
    return readFile(
      join(process.cwd(), 'apps', 'web', 'supabase', 'migrations', path),
      'utf8',
    );
  }

  static CreateMigration(name: string) {
    return execSync(`pnpm --filter web supabase migrations new ${name}`);
  }

  static Diff() {
    return execSync(`pnpm --filter web supabase db diff`);
  }
}

export function registerGetMigrationsTools(server: McpServer) {
  createGetMigrationsTool(server);
  createGetMigrationContentTool(server);
  createCreateMigrationTool(server);
  createDiffMigrationTool(server);
}

function createDiffMigrationTool(server: McpServer) {
  return server.registerTool(
    'diff_migrations',
    {
      description:
        'Compare differences between the declarative schemas and the applied migrations in Supabase',
    },
    async () => {
      const result = MigrationsTool.Diff();
      const text = result.toString('utf8');

      return {
        content: [
          {
            type: 'text',
            text,
          },
        ],
      };
    },
  );
}

function createCreateMigrationTool(server: McpServer) {
  return server.registerTool(
    'create_migration',
    {
      description: 'Create a new Supabase Postgres migration file',
      inputSchema: {
        state: z.object({
          name: z.string(),
        }),
      },
    },
    async ({ state }) => {
      const result = MigrationsTool.CreateMigration(state.name);
      const text = result.toString('utf8');

      return {
        content: [
          {
            type: 'text',
            text,
          },
        ],
      };
    },
  );
}

function createGetMigrationContentTool(server: McpServer) {
  return server.registerTool(
    'get_migration_content',
    {
      description:
        '📜 Get migration file content (HISTORICAL) - For current state use get_schema_content instead',
      inputSchema: {
        state: z.object({
          path: z.string(),
        }),
      },
    },
    async ({ state }) => {
      const content = await MigrationsTool.getMigrationContent(state.path);

      return {
        content: [
          {
            type: 'text',
            text: `📜 MIGRATION FILE: ${state.path} (HISTORICAL)\n\nNote: This shows historical changes. For current database state, use get_schema_content instead.\n\n${content}`,
          },
        ],
      };
    },
  );
}

function createGetMigrationsTool(server: McpServer) {
  return server.registerTool(
    'get_migrations',
    {
      description:
        '📜 Get migration files (HISTORICAL CHANGES) - Use schema files for current state instead',
    },
    async () => {
      const migrations = await MigrationsTool.GetMigrations();

      return {
        content: [
          {
            type: 'text',
            text: `📜 MIGRATION FILES (HISTORICAL CHANGES)\n\nNote: For current database state, use get_schema_files instead. Migrations show historical changes.\n\n${migrations.join('\n')}`,
          },
        ],
      };
    },
  );
}
