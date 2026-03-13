import type {
  KitEmailsListInput,
  KitEmailsListOutput,
  KitEmailsReadInput,
  KitEmailsReadOutput,
  KitEmailsSetReadStatusInput,
  KitEmailsSetReadStatusOutput,
} from './schema';

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface KitMailboxDeps {
  executeCommand(command: string, args: string[]): Promise<CommandResult>;
  isPortOpen(port: number): Promise<boolean>;
  fetchJson(url: string): Promise<unknown>;
  requestJson(
    url: string,
    init?: {
      method?: string;
      body?: string;
      headers?: Record<string, string>;
    },
  ): Promise<unknown>;
}

interface MailServerStatus {
  running: boolean;
  running_via_docker: boolean;
  api_base_url: string;
}

const MAILPIT_HTTP_PORT = 54324;
const MAILPIT_API_BASE_URL = 'http://127.0.0.1:54324/api/v1';

export function createKitMailboxService(deps: KitMailboxDeps) {
  return new KitMailboxService(deps);
}

export class KitMailboxService {
  constructor(private readonly deps: KitMailboxDeps) {}

  async list(input: KitEmailsListInput): Promise<KitEmailsListOutput> {
    const mailServer = await this.ensureMailServerReady();

    const payload = asRecord(
      await this.deps.fetchJson(
        `${MAILPIT_API_BASE_URL}/messages?start=${input.start}&limit=${input.limit}`,
      ),
    );

    const messages = asArray(payload.messages ?? payload.Messages).map(
      (message) => this.toSummary(asRecord(message)),
    );

    return {
      mail_server: mailServer,
      start: toNumber(payload.start ?? payload.Start) ?? input.start,
      limit: toNumber(payload.limit ?? payload.Limit) ?? input.limit,
      count: toNumber(payload.count ?? payload.Count) ?? messages.length,
      total: toNumber(payload.total ?? payload.Total) ?? messages.length,
      unread: toNumber(payload.unread ?? payload.Unread),
      messages,
    };
  }

  async read(input: KitEmailsReadInput): Promise<KitEmailsReadOutput> {
    const mailServer = await this.ensureMailServerReady();

    const message = asRecord(
      await this.deps.fetchJson(
        `${MAILPIT_API_BASE_URL}/message/${encodeURIComponent(input.id)}`,
      ),
    );

    return {
      mail_server: mailServer,
      id: toString(message.ID ?? message.id) ?? input.id,
      message_id: toString(message.MessageID ?? message.messageId),
      subject: toString(message.Subject ?? message.subject),
      from: readAddressList(message.From ?? message.from),
      to: readAddressList(message.To ?? message.to),
      cc: readAddressList(message.Cc ?? message.cc),
      bcc: readAddressList(message.Bcc ?? message.bcc),
      created_at: toString(message.Created ?? message.created),
      size: toNumber(message.Size ?? message.size),
      read: toBoolean(message.Read ?? message.read) ?? false,
      readAt: toString(message.ReadAt ?? message.readAt),
      text: readBody(message.Text ?? message.text),
      html: readBody(message.HTML ?? message.Html ?? message.html),
      headers: readHeaders(message.Headers ?? message.headers),
      raw: message,
    };
  }

  async setReadStatus(
    input: KitEmailsSetReadStatusInput,
  ): Promise<KitEmailsSetReadStatusOutput> {
    await this.ensureMailServerReady();

    const response = asRecord(
      await this.deps.requestJson(
        `${MAILPIT_API_BASE_URL}/message/${encodeURIComponent(input.id)}/read`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ read: input.read }),
        },
      ),
    );

    const read = toBoolean(response.Read ?? response.read) ?? input.read;
    const readAt = toString(response.ReadAt ?? response.readAt);

    return {
      id: toString(response.ID ?? response.id) ?? input.id,
      read,
      ...(readAt ? { readAt } : {}),
    };
  }

  private toSummary(message: Record<string, unknown>) {
    const readAt = toString(message.ReadAt ?? message.readAt);

    return {
      id: toString(message.ID ?? message.id) ?? '',
      message_id: toString(message.MessageID ?? message.messageId),
      subject: toString(message.Subject ?? message.subject),
      from: readAddressList(message.From ?? message.from),
      to: readAddressList(message.To ?? message.to),
      created_at: toString(message.Created ?? message.created),
      size: toNumber(message.Size ?? message.size),
      read: toBoolean(message.Read ?? message.read) ?? false,
      ...(readAt ? { readAt } : {}),
    };
  }

  private async ensureMailServerReady(): Promise<MailServerStatus> {
    const running = await this.deps.isPortOpen(MAILPIT_HTTP_PORT);
    const runningViaDocker = await this.isMailpitRunningViaDocker();

    if (!running) {
      if (runningViaDocker) {
        throw new Error(
          'Mailpit appears running in docker but API is unreachable at http://127.0.0.1:8025',
        );
      }

      throw new Error(
        'Mailpit is not running. Start local services with "pnpm compose:dev:up".',
      );
    }

    await this.deps.fetchJson(`${MAILPIT_API_BASE_URL}/info`);

    return {
      running,
      running_via_docker: runningViaDocker,
      api_base_url: MAILPIT_API_BASE_URL,
    };
  }

  private async isMailpitRunningViaDocker() {
    try {
      const result = await this.deps.executeCommand('docker', [
        'compose',
        '-f',
        'docker-compose.dev.yml',
        'ps',
        '--status',
        'running',
        '--services',
      ]);

      const services = result.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      return services.includes('mailpit');
    } catch {
      return false;
    }
  }
}

function readHeaders(input: unknown) {
  const headers = asRecord(input);
  const normalized: Record<string, string[]> = {};

  for (const [key, value] of Object.entries(headers)) {
    normalized[key] = asArray(value)
      .map((item) => toString(item))
      .filter((item): item is string => item !== null);
  }

  return normalized;
}

function readBody(input: unknown): string | null {
  if (typeof input === 'string') {
    return input;
  }

  if (Array.isArray(input)) {
    const chunks = input
      .map((item) => toString(item))
      .filter((item): item is string => item !== null);

    return chunks.length > 0 ? chunks.join('\n\n') : null;
  }

  return null;
}

function readAddressList(input: unknown): string[] {
  return asArray(input)
    .map((entry) => {
      const item = asRecord(entry);
      const address =
        toString(item.Address ?? item.address ?? item.Email ?? item.email) ??
        '';
      const name = toString(item.Name ?? item.name);

      if (!address) {
        return null;
      }

      return name ? `${name} <${address}>` : address;
    })
    .filter((value): value is string => value !== null);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
