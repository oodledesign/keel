import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import {
  generatePhasePageMarkdown,
  generatePhasePlanJson,
  generateProjectBriefMarkdown,
  type ProjectSourceBlock,
} from '~/lib/ai/project-content-generate';
import { Database } from '~/lib/database.types';

import type {
  ApplyProjectPhasePlanInput,
  GenerateProjectContentInput,
  ListProjectAiSourcesInput,
  ProjectAiSourceListItem,
  ProjectAiSourcesResult,
  ProjectSourceRef,
} from '../schema/project-ai.schema';

const DEFAULT_PHASE_COLOURS = [
  '#3B82F6',
  '#8B5CF6',
  '#FF5C34',
  '#F97316',
  '#64748B',
  '#EAB308',
];

export function createProjectAiService(client: SupabaseClient<Database>) {
  return new ProjectAiService(client);
}

class ProjectAiService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private get db(): any {
    return this.client;
  }

  private throwErr(err: unknown, fallback = 'Something went wrong'): never {
    if (err instanceof Error) throw err;
    const msg =
      err &&
      typeof err === 'object' &&
      'message' in err &&
      typeof (err as { message: unknown }).message === 'string'
        ? (err as { message: string }).message
        : fallback;
    throw new Error(msg);
  }

  private async ensureUserAndJobsEdit(accountId: string) {
    const { data: user } = await requireUser(this.client);
    if (!user) throw new Error('Authentication required');
    const api = createTeamAccountsApi(this.client);
    const hasPermission = await api.hasPermission({
      userId: user.id,
      accountId,
      permission: 'jobs.edit',
    });
    if (!hasPermission) throw new Error('Permission denied');
    return user;
  }

  private async getJobContext(accountId: string, jobId: string) {
    const { data, error } = await this.db
      .from('projects')
      .select('id, title, client_id, account_id')
      .eq('id', jobId)
      .eq('account_id', accountId)
      .eq('project_type', 'delivery')
      .maybeSingle();

    if (error) this.throwErr(error);
    if (!data) throw new Error('Project not found');

    let clientName: string | null = null;
    if (data.client_id) {
      const { data: client } = await this.db
        .from('clients')
        .select('display_name')
        .eq('id', data.client_id)
        .eq('account_id', accountId)
        .maybeSingle();
      clientName = (client?.display_name as string | null) ?? null;
    }

    return {
      jobId: data.id as string,
      jobTitle: (data.title as string) ?? 'Project',
      clientId: (data.client_id as string | null) ?? null,
      clientName,
    };
  }

  async listProjectAiSources(
    input: ListProjectAiSourcesInput,
  ): Promise<ProjectAiSourcesResult> {
    await requireUser(this.client);
    const ctx = await this.getJobContext(input.accountId, input.jobId);

    const transcripts: ProjectAiSourceListItem[] = [];
    const proposals: ProjectAiSourceListItem[] = [];
    const notes: ProjectAiSourceListItem[] = [];
    const docs: ProjectAiSourceListItem[] = [];

    if (ctx.clientId) {
      const { data: transcriptRows } = await this.db
        .from('meeting_transcripts')
        .select('id, title, content, created_at')
        .eq('account_id', input.accountId)
        .eq('client_id', ctx.clientId)
        .order('created_at', { ascending: false })
        .limit(50);

      for (const row of transcriptRows ?? []) {
        transcripts.push({
          id: row.id,
          type: 'transcript',
          title: (row.title as string) || 'Meeting transcript',
          subtitle: new Date(row.created_at as string).toLocaleDateString(
            'en-GB',
          ),
          preview: ((row.content as string) ?? '').slice(0, 160),
          date: row.created_at as string,
        });
      }

      const { data: proposalRows } = await this.db
        .from('proposals')
        .select('id, title, status, content_html, updated_at')
        .eq('account_id', input.accountId)
        .eq('client_id', ctx.clientId)
        .order('updated_at', { ascending: false })
        .limit(30);

      for (const row of proposalRows ?? []) {
        proposals.push({
          id: row.id,
          type: 'proposal',
          title: (row.title as string) || 'Proposal',
          subtitle: String(row.status ?? 'draft'),
          preview: ((row.content_html as string) ?? '').replace(/<[^>]+>/g, ' ').slice(0, 160),
          date: row.updated_at as string,
        });
      }
    }

    let notesQuery = this.db
      .from('notes')
      .select('id, title, content, updated_at, project_id, client_id')
      .eq('account_id', input.accountId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (ctx.clientId) {
      notesQuery = notesQuery.or(
        `project_id.eq.${input.jobId},client_id.eq.${ctx.clientId}`,
      );
    } else {
      notesQuery = notesQuery.eq('project_id', input.jobId);
    }

    const { data: noteRows, error: notesErr } = await notesQuery;
    if (notesErr) this.throwErr(notesErr);

    for (const row of noteRows ?? []) {
      notes.push({
        id: row.id,
        type: 'note',
        title: (row.title as string) || 'Note',
        subtitle: row.project_id === input.jobId ? 'On this project' : 'Client',
        preview: ((row.content as string) ?? '').slice(0, 160),
        date: row.updated_at as string,
      });
    }

    let docsQuery = this.db
      .from('docs')
      .select('id, title, content, kind, updated_at, project_id, client_id, doc_type')
      .eq('account_id', input.accountId)
      .neq('doc_type', 'phase_page')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (ctx.clientId) {
      docsQuery = docsQuery.or(
        `project_id.eq.${input.jobId},client_id.eq.${ctx.clientId}`,
      );
    } else {
      docsQuery = docsQuery.eq('project_id', input.jobId);
    }

    const { data: docRows, error: docsErr } = await docsQuery;
    if (docsErr) this.throwErr(docsErr);

    for (const row of docRows ?? []) {
      if (row.kind !== 'written') continue;
      docs.push({
        id: row.id,
        type: 'file',
        title: (row.title as string) || 'Document',
        subtitle: (row.doc_type as string) || 'document',
        preview: ((row.content as string) ?? '').slice(0, 160),
        date: row.updated_at as string,
      });
    }

    return { transcripts, proposals, notes, docs };
  }

  private async loadSourceBlocks(
    accountId: string,
    refs: ProjectSourceRef[],
  ): Promise<ProjectSourceBlock[]> {
    const blocks: ProjectSourceBlock[] = [];

    for (const ref of refs) {
      if (ref.type === 'transcript') {
        const { data, error } = await this.db
          .from('meeting_transcripts')
          .select('title, content')
          .eq('id', ref.id)
          .eq('account_id', accountId)
          .maybeSingle();
        if (error) this.throwErr(error);
        if (data) {
          blocks.push({
            type: 'transcript',
            id: ref.id,
            title: ref.title,
            content: (data.content as string) ?? '',
          });
        }
      } else if (ref.type === 'proposal') {
        const { data, error } = await this.db
          .from('proposals')
          .select('title, content_html')
          .eq('id', ref.id)
          .eq('account_id', accountId)
          .maybeSingle();
        if (error) this.throwErr(error);
        if (data) {
          blocks.push({
            type: 'proposal',
            id: ref.id,
            title: ref.title,
            content: (data.content_html as string) ?? '',
          });
        }
      } else if (ref.type === 'note') {
        const { data, error } = await this.db
          .from('notes')
          .select('title, content')
          .eq('id', ref.id)
          .eq('account_id', accountId)
          .maybeSingle();
        if (error) this.throwErr(error);
        if (data) {
          blocks.push({
            type: 'note',
            id: ref.id,
            title: ref.title,
            content: (data.content as string) ?? '',
          });
        }
      } else {
        const { data, error } = await this.db
          .from('docs')
          .select('title, content, kind')
          .eq('id', ref.id)
          .eq('account_id', accountId)
          .maybeSingle();
        if (error) this.throwErr(error);
        if (data) {
          blocks.push({
            type: 'file',
            id: ref.id,
            title: ref.title,
            content:
              data.kind === 'written'
                ? ((data.content as string) ?? '')
                : '[Uploaded file — text not extracted]',
          });
        }
      }
    }

    if (blocks.length === 0) {
      throw new Error('Could not load any selected sources');
    }

    return blocks;
  }

  async generateProjectContent(input: GenerateProjectContentInput) {
    const user = await this.ensureUserAndJobsEdit(input.accountId);
    const ctx = await this.getJobContext(input.accountId, input.jobId);
    const sources = await this.loadSourceBlocks(input.accountId, input.sourceRefs);
    const contextRefs = input.sourceRefs.map((r) => ({
      type: r.type,
      id: r.id,
      title: r.title,
    }));

    if (input.mode === 'phase_page' && !input.phaseId) {
      throw new Error('phaseId is required for phase page generation');
    }

    if (input.mode === 'brief') {
      const content = await generateProjectBriefMarkdown({
        jobTitle: ctx.jobTitle,
        clientName: ctx.clientName,
        sources,
      });

      const { data: doc, error } = await this.db
        .from('docs')
        .insert({
          account_id: input.accountId,
          project_id: input.jobId,
          title: `Project brief — ${ctx.jobTitle}`,
          content,
          kind: 'written',
          doc_type: 'project_brief',
          category: 'idea',
          tags: [],
          user_id: user.id,
          created_by: user.id,
          context_refs: contextRefs,
        })
        .select('id, title, content')
        .single();

      if (error) this.throwErr(error);
      return {
        mode: 'brief' as const,
        docId: doc.id as string,
        title: doc.title as string,
        content: doc.content as string,
      };
    }

    if (input.mode === 'phase_plan') {
      const result = await generatePhasePlanJson({
        jobTitle: ctx.jobTitle,
        clientName: ctx.clientName,
        sources,
      });

      if ('parseError' in result) {
        return {
          mode: 'phase_plan' as const,
          parseError: true as const,
          rawDraft: result.rawDraft,
        };
      }

      return {
        mode: 'phase_plan' as const,
        plan: result.plan,
        contextRefs,
      };
    }

    const phaseId = input.phaseId!;
    const { data: phase, error: phaseErr } = await this.db
      .from('project_phases')
      .select('id, name, project_id')
      .eq('id', phaseId)
      .eq('account_id', input.accountId)
      .eq('project_id', input.jobId)
      .maybeSingle();

    if (phaseErr) this.throwErr(phaseErr);
    if (!phase) throw new Error('Phase not found');

    const { data: pageDoc, error: docFindErr } = await this.db
      .from('docs')
      .select('id, content')
      .eq('account_id', input.accountId)
      .eq('phase_id', phaseId)
      .eq('doc_type', 'phase_page')
      .maybeSingle();

    if (docFindErr) this.throwErr(docFindErr);

    const existingContent = (pageDoc?.content as string | null) ?? '';
    const content = await generatePhasePageMarkdown({
      phaseName: phase.name as string,
      jobTitle: ctx.jobTitle,
      clientName: ctx.clientName,
      existingContent,
      sources,
    });

    const docId = pageDoc?.id as string | undefined;
    let resolvedDocId = docId;

    if (resolvedDocId) {
      const { error: updateErr } = await this.db
        .from('docs')
        .update({ content, context_refs: contextRefs })
        .eq('id', resolvedDocId)
        .eq('account_id', input.accountId);
      if (updateErr) this.throwErr(updateErr);
    } else {
      const { data: inserted, error: insertErr } = await this.db
        .from('docs')
        .insert({
          account_id: input.accountId,
          project_id: input.jobId,
          phase_id: phaseId,
          title: phase.name,
          content,
          kind: 'written',
          doc_type: 'phase_page',
          category: 'idea',
          tags: [],
          user_id: user.id,
          created_by: user.id,
          context_refs: contextRefs,
        })
        .select('id')
        .single();
      if (insertErr) this.throwErr(insertErr);
      resolvedDocId = inserted.id as string;
    }

    return {
      mode: 'phase_page' as const,
      docId: resolvedDocId,
      content,
    };
  }

  async applyProjectPhasePlan(input: ApplyProjectPhasePlanInput) {
    const user = await this.ensureUserAndJobsEdit(input.accountId);
    const ctx = await this.getJobContext(input.accountId, input.jobId);

    const { data: maxRow } = await this.db
      .from('project_phases')
      .select('sort_order')
      .eq('account_id', input.accountId)
      .eq('project_id', input.jobId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    let sortOrder = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;

    const planSummaryLines: string[] = [];

    for (const [index, phaseInput] of input.phases.entries()) {
      const { data: phase, error: phaseErr } = await this.db
        .from('project_phases')
        .insert({
          account_id: input.accountId,
          project_id: input.jobId,
          name: phaseInput.name.trim(),
          description: phaseInput.description?.trim() || null,
          status: 'not_started',
          is_milestone: phaseInput.is_milestone ?? false,
          colour:
            phaseInput.colour ??
            DEFAULT_PHASE_COLOURS[index % DEFAULT_PHASE_COLOURS.length],
          sort_order: sortOrder++,
          start_date: phaseInput.start_date || null,
          due_date: phaseInput.due_date || null,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (phaseErr) this.throwErr(phaseErr);
      const phaseId = phase.id as string;

      planSummaryLines.push(`## ${phaseInput.name.trim()}`);
      if (phaseInput.description?.trim()) {
        planSummaryLines.push(phaseInput.description.trim());
      }

      for (const taskInput of phaseInput.tasks ?? []) {
        const { error: taskErr } = await this.db.from('tasks').insert({
          title: taskInput.title.trim(),
          status: 'todo',
          priority: taskInput.priority ?? 'medium',
          due_date: taskInput.due_date || null,
          user_id: user.id,
          account_id: input.accountId,
          project_id: input.jobId,
          phase_id: phaseId,
          client_id: ctx.clientId,
        });
        if (taskErr) this.throwErr(taskErr);
        planSummaryLines.push(`- ${taskInput.title.trim()}`);
      }

      planSummaryLines.push('');
    }

    if (input.contextRefs?.length) {
      const { error: auditErr } = await this.db.from('docs').insert({
        account_id: input.accountId,
        project_id: input.jobId,
        title: `Phase plan — ${ctx.jobTitle}`,
        content: planSummaryLines.join('\n').trim(),
        kind: 'written',
        doc_type: 'general',
        category: 'idea',
        tags: ['ai-phase-plan'],
        user_id: user.id,
        created_by: user.id,
        context_refs: input.contextRefs,
      });
      if (auditErr) this.throwErr(auditErr);
    }

    return { ok: true as const, phaseCount: input.phases.length };
  }
}
