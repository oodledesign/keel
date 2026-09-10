import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { loadLinkedNames } from './lookup';
import {
  type McpWorkspace,
  assertSupabaseOk,
  dealDisplayName,
  isMissingColumnError,
  loadUserWorkspaces,
  toolJson,
} from './shared';
import type { OzerMcpToolRegistrar } from './types';

const MEETING_CONTENT_LIMIT = 80_000;
const MEETING_EXCERPT_LIMIT = 280;

const listMeetingsSchema = z.object({
  account_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      'Workspace id. Omit to list meetings across authorized workspaces.',
    ),
  client_id: z
    .string()
    .uuid()
    .optional()
    .describe('Only pass when the user names a specific CRM client.'),
  project_id: z
    .string()
    .uuid()
    .optional()
    .describe('Only pass when the user names a specific project.'),
  q: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .describe('Optional title search. Do not invent other filters.'),
  limit: z.number().int().min(1).max(100).optional().default(50),
});

const getMeetingSchema = z.object({
  id: z.string().uuid(),
});

export const MEETING_LIST_SELECT =
  'id, account_id, client_id, deal_id, project_id, title, content, source, meeting_date, created_at, updated_at';

const MEETING_LIST_SELECT_LEGACY =
  'id, account_id, client_id, deal_id, title, content, source, meeting_date, created_at, updated_at';

const MEETING_DETAIL_SELECT = MEETING_LIST_SELECT;
const MEETING_DETAIL_SELECT_LEGACY = MEETING_LIST_SELECT_LEGACY;

export type MeetingRow = {
  id: string;
  account_id?: string | null;
  client_id?: string | null;
  deal_id?: string | null;
  project_id?: string | null;
  title?: string | null;
  content?: string | null;
  source?: string | null;
  meeting_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function meetingTitle(row: MeetingRow): string {
  return row.title?.trim() || 'Meeting transcript';
}

export function meetingExcerpt(
  content: string | null | undefined,
  limit = MEETING_EXCERPT_LIMIT,
): string | null {
  const text = content?.replace(/\s+/g, ' ').trim();
  if (!text) {
    return null;
  }

  return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
}

export function clipMeetingContent(content: string | null | undefined): {
  content: string;
  truncated: boolean;
} {
  const text = content ?? '';
  if (text.length <= MEETING_CONTENT_LIMIT) {
    return { content: text, truncated: false };
  }

  return {
    content: text.slice(0, MEETING_CONTENT_LIMIT),
    truncated: true,
  };
}

function workspaceExtras(
  workspaces: McpWorkspace[],
  accountId: string | null | undefined,
) {
  const workspace = accountId
    ? workspaces.find((item) => item.id === accountId)
    : undefined;

  return {
    workspace_name: workspace?.name ?? null,
    workspace_slug: workspace?.slug ?? null,
  };
}

async function selectMeetings(
  supabase: SupabaseClient,
  accountIds: string[],
  filters: {
    client_id?: string;
    project_id?: string;
  },
) {
  let withProject = supabase
    .from('meeting_transcripts')
    .select(MEETING_LIST_SELECT)
    .in('account_id', accountIds)
    .order('meeting_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (filters.client_id) {
    withProject = withProject.eq('client_id', filters.client_id);
  }
  if (filters.project_id) {
    withProject = withProject.eq('project_id', filters.project_id);
  }

  const primary = await withProject;
  if (!primary.error) {
    return (primary.data ?? []) as MeetingRow[];
  }

  if (!isMissingColumnError(primary.error)) {
    assertSupabaseOk(primary.data, primary.error, 'list meetings');
  }

  if (filters.project_id) {
    return [];
  }

  let legacy = supabase
    .from('meeting_transcripts')
    .select(MEETING_LIST_SELECT_LEGACY)
    .in('account_id', accountIds)
    .order('created_at', { ascending: false });

  if (filters.client_id) {
    legacy = legacy.eq('client_id', filters.client_id);
  }

  const result = await legacy;
  assertSupabaseOk(result.data, result.error, 'list meetings');
  return (result.data ?? []) as MeetingRow[];
}

async function loadMeetingRow(
  supabase: SupabaseClient,
  id: string,
): Promise<MeetingRow> {
  const withProject = await supabase
    .from('meeting_transcripts')
    .select(MEETING_DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (withProject.error && isMissingColumnError(withProject.error)) {
    const legacy = await supabase
      .from('meeting_transcripts')
      .select(MEETING_DETAIL_SELECT_LEGACY)
      .eq('id', id)
      .maybeSingle();

    assertSupabaseOk(legacy.data, legacy.error, 'get meeting');
    if (!legacy.data) {
      throw new Error('Meeting not found');
    }

    return legacy.data as MeetingRow;
  }

  assertSupabaseOk(withProject.data, withProject.error, 'get meeting');
  if (!withProject.data) {
    throw new Error('Meeting not found');
  }

  return withProject.data as MeetingRow;
}

async function loadDealNames(
  supabase: SupabaseClient,
  dealIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(dealIds.filter(Boolean))];
  if (unique.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('pipeline_deals')
    .select('id, name, contact_name, company_name')
    .in('id', unique);

  if (error) {
    return new Map();
  }

  return new Map(
    (
      (data ?? []) as Array<{
        id: string;
        name?: string | null;
        contact_name?: string | null;
        company_name?: string | null;
      }>
    ).map((row) => [row.id, dealDisplayName(row)]),
  );
}

async function loadMeetingSummary(
  supabase: SupabaseClient,
  meetingId: string,
): Promise<string | null> {
  const result = await supabase
    .from('meeting_summaries')
    .select('summary_text')
    .eq('meeting_transcript_id', meetingId)
    .maybeSingle();

  if (result.error) {
    return null;
  }

  return (
    (result.data as { summary_text?: string | null } | null)?.summary_text ??
    null
  );
}

async function enrichMeetings(
  supabase: SupabaseClient,
  rows: MeetingRow[],
  workspaces: McpWorkspace[],
) {
  const extras = await loadLinkedNames(
    supabase,
    rows.map((row) => ({
      id: row.id,
      project_id: row.project_id,
      client_id: row.client_id,
      account_id: row.account_id,
    })),
    workspaces,
  );
  const deals = await loadDealNames(
    supabase,
    rows.map((row) => row.deal_id ?? ''),
  );

  return rows.map((row) => {
    const names = extras.get(row.id);
    const workspace = workspaceExtras(workspaces, row.account_id);

    return {
      id: row.id,
      title: meetingTitle(row),
      source: row.source ?? null,
      meeting_date: row.meeting_date ?? null,
      client_id: row.client_id ?? null,
      client_name: names?.client_name ?? null,
      project_id: row.project_id ?? null,
      project_name: names?.project_name ?? null,
      deal_id: row.deal_id ?? null,
      deal_name: row.deal_id ? (deals.get(row.deal_id) ?? null) : null,
      account_id: row.account_id ?? null,
      workspace_name: names?.workspace_name ?? workspace.workspace_name,
      workspace_slug: names?.workspace_slug ?? workspace.workspace_slug,
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
    };
  });
}

export const registerMeetingTools: OzerMcpToolRegistrar = (server, context) => {
  const { supabase, userId } = context;

  server.registerTool(
    'list_meetings',
    {
      description:
        'List meeting transcripts (meeting_transcripts) in authorized workspaces, with client/project/workspace names. Do not pass client_id or project_id unless the user names them (use search_clients / search_projects first). Optional q searches titles only.',
      inputSchema: listMeetingsSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const accountIds = input.account_id
        ? workspaces.some((workspace) => workspace.id === input.account_id)
          ? [input.account_id]
          : []
        : workspaces.map((workspace) => workspace.id);

      if (accountIds.length === 0) {
        return toolJson({ meetings: [] });
      }

      const rows = await selectMeetings(supabase, accountIds, {
        client_id: input.client_id,
        project_id: input.project_id,
      });

      const needle = input.q?.trim().toLowerCase();
      const filtered = rows
        .filter((row) => {
          if (!needle) {
            return true;
          }

          return meetingTitle(row).toLowerCase().includes(needle);
        })
        .slice(0, input.limit);

      const meetings = await enrichMeetings(supabase, filtered, workspaces);

      return toolJson({
        meetings: meetings.map((meeting, index) => ({
          ...meeting,
          excerpt: meetingExcerpt(filtered[index]?.content),
        })),
      });
    },
  );

  server.registerTool(
    'get_meeting',
    {
      description:
        'Get one meeting transcript by id, including title, stored content, optional AI summary, and client/project/workspace names. Meetings are meeting_transcripts rows, not calendar events.',
      inputSchema: getMeetingSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const row = await loadMeetingRow(supabase, input.id);
      const accountId = row.account_id;
      if (
        !accountId ||
        !workspaces.some((workspace) => workspace.id === accountId)
      ) {
        throw new Error('Meeting not found');
      }

      const [mapped] = await enrichMeetings(supabase, [row], workspaces);
      const clipped = clipMeetingContent(row.content);
      const summary = await loadMeetingSummary(supabase, row.id);

      return toolJson({
        meeting: {
          ...mapped,
          ...clipped,
          summary,
        },
      });
    },
  );
};
