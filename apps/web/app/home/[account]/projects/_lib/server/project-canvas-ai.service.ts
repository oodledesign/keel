import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import { callAI } from '~/lib/ai/router';
import type { Database } from '~/lib/database.types';
import {
  type CanvasAiResult,
  buildCanvasAiPrompt,
  parseCanvasAiResponse,
} from '~/lib/projects/canvas/canvas-ai';
import { looseClient } from '~/lib/retainers/loose-client';

import type { CanvasAiAssistInput } from '../schema/project-canvas-ai.schema';

const MAX_CONTEXT_CHARS = 14_000;

type Row = Record<string, unknown>;
const str = (value: unknown) => (typeof value === 'string' ? value : '');

export function createProjectCanvasAiService(client: SupabaseClient<Database>) {
  return new ProjectCanvasAiService(client);
}

class ProjectCanvasAiService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private get loose() {
    return looseClient(this.client);
  }

  async assist(input: CanvasAiAssistInput): Promise<CanvasAiResult> {
    const { data: user, error: userError } = await requireUser(this.client);
    if (userError || !user) throw new Error('Authentication required');

    const { data: canEdit, error } = await this.loose.rpc(
      'can_edit_project_canvas',
      { p_account_id: input.accountId },
    );
    if (error) throw new Error(error.message);
    if (canEdit !== true) throw new Error('Permission denied');

    const context = await this.projectContext(input.accountId, input.jobId);
    const today = new Date().toISOString().slice(0, 10);
    const { system, user: prompt } = buildCanvasAiPrompt(
      input.request,
      context,
      today,
    );
    const raw = await callAI({
      feature: 'project_canvas_assist',
      systemPrompt: system,
      userPrompt: prompt,
      accountId: input.accountId,
      supabase: this.client,
    });
    return parseCanvasAiResponse(input.request, raw);
  }

  /** A compact plain-text brief of the project for grounding. */
  private async projectContext(accountId: string, jobId: string) {
    const { data: project, error } = await this.client
      .from('projects')
      .select(
        'id, title, name, description, status, start_date, target_date, due_date, client_id',
      )
      .eq('id', jobId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error('Project not found');
    const p = project as Row;

    const [client, phases, tasks, notes, team, clientTeam] = await Promise.all([
      p.client_id
        ? this.client
            .from('clients')
            .select('display_name, company_name')
            .eq('id', str(p.client_id))
            .eq('account_id', accountId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      this.loose
        .from('project_phases')
        .select('name, status, start_date, due_date, is_milestone')
        .eq('project_id', jobId)
        .order('sort_order', { ascending: true })
        .limit(30),
      this.loose
        .from('tasks')
        .select('title, status, due_date')
        .eq('project_id', jobId)
        .is('parent_task_id', null)
        .not('status', 'in', '(done,cancelled)')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(40),
      this.loose
        .from('notes')
        .select('title, content')
        .eq('project_id', jobId)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(6),
      this.loose
        .from('project_contacts')
        .select('contact_id, role, contact:contacts(full_name)')
        .eq('project_id', jobId)
        .limit(20),
      p.client_id
        ? this.client
            .from('client_contacts')
            .select('contact_id, role, contact:contacts(full_name)')
            .eq('client_id', str(p.client_id))
            .limit(20)
        : Promise.resolve({ data: [] }),
    ]);

    const lines: string[] = [];
    lines.push(`Project: ${str(p.title) || str(p.name) || 'Untitled'}`);
    const clientRow = client.data as Row | null;
    if (clientRow) {
      lines.push(
        `Client: ${str(clientRow.display_name) || str(clientRow.company_name)}`,
      );
    }
    if (p.status) lines.push(`Status: ${str(p.status)}`);
    const dates = [
      p.start_date && `starts ${str(p.start_date)}`,
      (p.target_date || p.due_date) &&
        `due ${str(p.target_date) || str(p.due_date)}`,
    ].filter(Boolean);
    if (dates.length) lines.push(`Dates: ${dates.join(', ')}`);
    if (p.description)
      lines.push(`Description: ${str(p.description).slice(0, 1500)}`);

    const phaseRows = (phases.data ?? []) as Row[];
    if (phaseRows.length) {
      lines.push('', 'Phases:');
      for (const phase of phaseRows) {
        const when = [str(phase.start_date), str(phase.due_date)]
          .filter(Boolean)
          .join(' → ');
        lines.push(
          `- ${str(phase.name)}${phase.is_milestone ? ' (milestone)' : ''} [${str(phase.status)}]${when ? ` ${when}` : ''}`,
        );
      }
    }

    const taskRows = (tasks.data ?? []) as Row[];
    if (taskRows.length) {
      lines.push('', 'Open tasks:');
      for (const task of taskRows) {
        lines.push(
          `- ${str(task.title)}${task.due_date ? ` (due ${str(task.due_date)})` : ''}`,
        );
      }
    }

    const projectRows = (team.data ?? []) as Row[];
    const onProject = new Set(projectRows.map((row) => str(row.contact_id)));
    const teamRows = [
      ...((clientTeam.data ?? []) as Row[]).filter(
        (row) => !onProject.has(str(row.contact_id)),
      ),
      ...projectRows,
    ];
    if (teamRows.length) {
      lines.push('', 'People:');
      for (const row of teamRows) {
        const contact = row.contact as Row | null;
        lines.push(
          `- ${str(contact?.full_name)}${row.role ? ` — ${str(row.role)}` : ''}`,
        );
      }
    }

    const noteRows = (notes.data ?? []) as Row[];
    if (noteRows.length) {
      lines.push('', 'Notes:');
      for (const row of noteRows) {
        lines.push(
          `- ${str(row.title) || 'Untitled'}: ${str(row.content).replace(/\s+/g, ' ').slice(0, 600)}`,
        );
      }
    }

    return lines.join('\n').slice(0, MAX_CONTEXT_CHARS);
  }
}
