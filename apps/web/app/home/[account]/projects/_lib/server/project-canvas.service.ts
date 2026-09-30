import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { Database } from '~/lib/database.types';
import {
  type CanvasItem,
  canvasItemFromRow,
} from '~/lib/projects/canvas/canvas-types';
import { looseClient } from '~/lib/retainers/loose-client';

import {
  isMissingRelationError,
  logMissingRelation,
} from '../../../_lib/server/supabase-errors';
import type {
  CreateProjectCanvasNoteInput,
  DeleteProjectCanvasItemsInput,
  LoadProjectCanvasInput,
  LoadProjectCanvasNoteInput,
  ProjectCanvasComment,
  ProjectCanvasContact,
  ProjectCanvasDoc,
  ProjectCanvasMember,
  ProjectCanvasNote,
  ProjectCanvasPerson,
  UpdateProjectCanvasNoteInput,
  UpsertProjectCanvasItemsInput,
} from '../schema/project-canvas.schema';
import {
  CANVAS_COMMENT_COLUMNS,
  toCanvasComment,
} from './project-canvas-comments.service';

const CANVAS_ITEM_COLUMNS =
  'id, kind, ref_id, x, y, w, h, z_index, data, updated_at, updated_by';

export type ProjectCanvasSnapshot = {
  /** False until the canvas migration is applied. */
  available: boolean;
  items: CanvasItem[];
  notes: ProjectCanvasNote[];
  members: ProjectCanvasMember[];
  contacts: ProjectCanvasContact[];
  docs: ProjectCanvasDoc[];
  comments: ProjectCanvasComment[];
  people: ProjectCanvasPerson[];
};

const UNDEFINED_COLUMN = '42703';
const COMMENT_LIMIT = 500;
const DOC_LIMIT = 200;
/** Internal pages that already show up as phases or the brief. */
const HIDDEN_DOC_TYPES = ['phase_page'];

const CONTACT_COLUMNS = 'full_name, email, phone, picture_url, company_name';

type ContactDetails = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  picture_url: string | null;
  company_name: string | null;
};

type ProjectContactRow = {
  contact_id: string;
  role: string | null;
  description: string | null;
  contact: ContactDetails | null;
};

type ClientContactRow = {
  contact_id: string;
  role: string | null;
  is_primary: boolean | null;
  contact: ContactDetails | null;
};

type DocRow = {
  id: string;
  title: string | null;
  kind: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  doc_type: string | null;
  updated_at: string | null;
};

const NOTE_COLUMNS =
  'id, title, content, project_id, phase_id, is_pinned, updated_at';
/** Keeps the 30s resync payload small; the editor loads the full note. */
const NOTE_DISPLAY_CHARS = 6000;

type NoteRow = {
  id: string;
  title: string | null;
  content: string | null;
  project_id: string | null;
  phase_id: string | null;
  is_pinned: boolean;
  updated_at: string | null;
};

function toCanvasNote(note: NoteRow, limit: number | null): ProjectCanvasNote {
  const content = note.content ?? '';
  const truncated = limit !== null && content.length > limit;
  return {
    id: note.id,
    title: note.title,
    content: truncated ? content.slice(0, limit) : content,
    truncated,
    phaseId: note.phase_id,
    isPinned: note.is_pinned,
    updatedAt: note.updated_at,
  };
}

function projectOrPhaseFilter(jobId: string, phaseIds: string[]) {
  return phaseIds.length > 0
    ? `project_id.eq.${jobId},phase_id.in.(${phaseIds.join(',')})`
    : `project_id.eq.${jobId}`;
}

export function createProjectCanvasService(client: SupabaseClient<Database>) {
  return new ProjectCanvasService(client);
}

class ProjectCanvasService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private async requireUserId() {
    const { data, error } = await requireUser(this.client);
    if (error || !data) throw new Error('Authentication required');
    return data.id;
  }

  private async verifyProject(accountId: string, jobId: string) {
    const { data, error } = await this.client
      .from('projects')
      .select('id')
      .eq('id', jobId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Project not found');
  }

  async load(input: LoadProjectCanvasInput): Promise<ProjectCanvasSnapshot> {
    const userId = await this.requireUserId();
    await this.verifyProject(input.accountId, input.jobId);

    const phaseIds = await this.projectPhaseIds(input);
    const [itemsResult, notes, members, contacts, docs, comments] =
      await Promise.all([
        looseClient(this.client)
          .from('project_canvas_items')
          .select(CANVAS_ITEM_COLUMNS)
          .eq('project_id', input.jobId)
          .eq('account_id', input.accountId)
          .order('created_at', { ascending: true }),
        this.loadNotes(input, phaseIds),
        this.loadMembers(input),
        this.loadContacts(input),
        this.loadDocs(input, phaseIds),
        this.loadComments(input),
      ]);

    const people = await this.loadPeople(input, userId, comments);
    const linked = { notes, members, contacts, docs, comments, people };
    if (itemsResult.error) {
      if (isMissingRelationError(itemsResult.error)) {
        logMissingRelation('project_canvas.load', itemsResult.error);
        return { available: false, items: [], ...linked };
      }
      throw new Error(itemsResult.error.message);
    }

    return {
      available: true,
      items: (itemsResult.data ?? []).map(canvasItemFromRow),
      ...linked,
    };
  }

  /**
   * Names for comment authors, task assignees and the viewer. Guests can't
   * read workspace members, and the team can't read guests, so this reads
   * personal accounts directly — only once `verifyProject` has passed, and
   * never emails.
   */
  private async loadPeople(
    input: LoadProjectCanvasInput,
    userId: string,
    comments: ProjectCanvasComment[],
  ): Promise<ProjectCanvasPerson[]> {
    const client = looseClient(this.client);
    const [viewer, guest] = await Promise.all([
      client.rpc('can_view_project_canvas', { p_project_id: input.jobId }),
      client.rpc('is_accepted_project_guest', {
        target_project_id: input.jobId,
      }),
    ]);
    if (viewer.data !== true && guest.data !== true) return [];

    const { data: tasks, error } = await this.client
      .from('tasks')
      .select('user_id')
      .eq('project_id', input.jobId)
      .not('user_id', 'is', null);
    if (error) throw new Error(error.message);

    const ids = new Set<string>([userId]);
    for (const comment of comments) ids.add(comment.authorId);
    for (const task of tasks ?? []) {
      if (task.user_id) ids.add(task.user_id);
    }

    const { data, error: accountsError } = await getSupabaseServerAdminClient()
      .from('accounts')
      .select('id, name, picture_url')
      .eq('is_personal_account', true)
      .in('id', [...ids]);
    if (accountsError) throw new Error(accountsError.message);

    return (data ?? []).map((account) => ({
      id: account.id,
      name: account.name?.trim() || null,
      pictureUrl: account.picture_url ?? null,
    }));
  }

  private async loadComments(
    input: LoadProjectCanvasInput,
  ): Promise<ProjectCanvasComment[]> {
    const { data, error } = await looseClient(this.client)
      .from('project_canvas_comments')
      .select(CANVAS_COMMENT_COLUMNS)
      .eq('project_id', input.jobId)
      .eq('account_id', input.accountId)
      .order('created_at', { ascending: false })
      .limit(COMMENT_LIMIT);
    if (error) {
      if (isMissingRelationError(error)) return [];
      throw new Error(error.message);
    }
    return (data ?? []).map(toCanvasComment).reverse();
  }

  private async loadMembers(
    input: LoadProjectCanvasInput,
  ): Promise<ProjectCanvasMember[]> {
    const query = (columns: string) =>
      looseClient(this.client)
        .from('project_assignments')
        .select(columns)
        .eq('project_id', input.jobId);

    let result = await query('user_id, role_on_project, description');
    if (result.error?.code === UNDEFINED_COLUMN) {
      result = await query('user_id, role_on_project');
    }
    if (result.error) throw new Error(result.error.message);

    return (result.data ?? []).map((row) => ({
      userId: row.user_id as string,
      role: (row.role_on_project as string | null) ?? null,
      description: (row.description as string | null | undefined) ?? null,
    }));
  }

  /**
   * People added to the project, plus everyone on the project's client
   * record. Client contacts use their client role until given a project one.
   */
  private async loadContacts(
    input: LoadProjectCanvasInput,
  ): Promise<ProjectCanvasContact[]> {
    const [contactsResult, clientId] = await Promise.all([
      looseClient(this.client)
        .from('project_contacts')
        .select(
          `contact_id, role, description, contact:contacts(${CONTACT_COLUMNS})`,
        )
        .eq('project_id', input.jobId)
        .eq('account_id', input.accountId)
        .order('created_at', { ascending: true }),
      this.projectClientId(input),
    ]);

    let rows: ProjectContactRow[] = [];
    if (contactsResult.error) {
      if (!isMissingRelationError(contactsResult.error)) {
        throw new Error(contactsResult.error.message);
      }
      logMissingRelation('project_canvas.contacts', contactsResult.error);
    } else {
      rows = (contactsResult.data ?? []) as unknown as ProjectContactRow[];
    }

    const clientRows: ClientContactRow[] = [];
    if (clientId) {
      const { data, error } = await this.client
        .from('client_contacts')
        .select(
          `contact_id, role, is_primary, contact:contacts(${CONTACT_COLUMNS})`,
        )
        .eq('client_id', clientId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      clientRows.push(...((data ?? []) as unknown as ClientContactRow[]));
    }

    const clientRoles = new Map(
      clientRows.map((row) => [row.contact_id, row.role]),
    );
    const onProject = new Set(rows.map((row) => row.contact_id));
    const merged: ProjectContactRow[] = [
      ...clientRows
        .filter((row) => !onProject.has(row.contact_id))
        .map((row) => ({ ...row, role: null, description: null })),
      ...rows,
    ];

    return merged.map((row) => ({
      id: row.contact_id,
      name: row.contact?.full_name || row.contact?.email || 'Contact',
      email: row.contact?.email ?? null,
      phone: row.contact?.phone ?? null,
      pictureUrl: row.contact?.picture_url ?? null,
      companyName: row.contact?.company_name ?? null,
      role: row.role ?? clientRoles.get(row.contact_id) ?? null,
      description: row.description,
      isClientContact: clientRoles.has(row.contact_id),
    }));
  }

  private async loadDocs(
    input: LoadProjectCanvasInput,
    phaseIds: string[],
  ): Promise<ProjectCanvasDoc[]> {
    const { data, error } = await this.client
      .from('docs')
      .select(
        'id, title, kind, mime_type, file_size_bytes, doc_type, updated_at',
      )
      .eq('account_id', input.accountId)
      .or(projectOrPhaseFilter(input.jobId, phaseIds))
      .not('doc_type', 'in', `(${HIDDEN_DOC_TYPES.join(',')})`)
      .order('updated_at', { ascending: false })
      .limit(DOC_LIMIT);
    if (error) throw new Error(error.message);

    return ((data ?? []) as DocRow[]).map((doc) => ({
      id: doc.id,
      title: doc.title || 'Untitled',
      kind: doc.kind === 'uploaded' ? 'uploaded' : 'written',
      mimeType: doc.mime_type,
      sizeBytes: doc.file_size_bytes,
      docType: doc.doc_type,
      updatedAt: doc.updated_at,
    }));
  }

  private async projectClientId(input: LoadProjectCanvasInput) {
    const { data, error } = await this.client
      .from('projects')
      .select('client_id')
      .eq('id', input.jobId)
      .eq('account_id', input.accountId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as { client_id: string | null } | null)?.client_id ?? null;
  }

  private async projectPhaseIds(input: LoadProjectCanvasInput) {
    const { data, error } = await this.client
      .from('project_phases')
      .select('id')
      .eq('account_id', input.accountId)
      .eq('project_id', input.jobId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((phase) => phase.id);
  }

  private async loadNotes(
    input: LoadProjectCanvasInput,
    phaseIds: string[],
  ): Promise<ProjectCanvasNote[]> {
    const { data, error } = await this.client
      .from('notes')
      .select(NOTE_COLUMNS)
      .eq('account_id', input.accountId)
      .or(projectOrPhaseFilter(input.jobId, phaseIds))
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    return ((data ?? []) as NoteRow[]).map((note) =>
      toCanvasNote(note, NOTE_DISPLAY_CHARS),
    );
  }

  /** A note shown on this project's canvas (project note or phase note). */
  private async requireProjectNote(
    input: LoadProjectCanvasNoteInput,
  ): Promise<NoteRow> {
    const [phaseIds, { data, error }] = await Promise.all([
      this.projectPhaseIds(input),
      this.client
        .from('notes')
        .select(NOTE_COLUMNS)
        .eq('id', input.noteId)
        .eq('account_id', input.accountId)
        .maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    const note = data as NoteRow | null;
    const inProject =
      note &&
      (note.project_id === input.jobId ||
        (note.phase_id !== null && phaseIds.includes(note.phase_id)));
    if (!inProject) throw new Error('Note not found');
    return note;
  }

  async loadNote(
    input: LoadProjectCanvasNoteInput,
  ): Promise<ProjectCanvasNote> {
    await this.requireUserId();
    await this.verifyProject(input.accountId, input.jobId);
    return toCanvasNote(await this.requireProjectNote(input), null);
  }

  private async requireCanEdit(accountId: string) {
    const userId = await this.requireUserId();
    const { data: canEdit, error } = await looseClient(this.client).rpc(
      'can_edit_project_canvas',
      { p_account_id: accountId },
    );
    if (error) throw new Error(error.message);
    if (canEdit !== true) throw new Error('Permission denied');
    return userId;
  }

  /** A new note on the project, created from the canvas. */
  async createNote(
    input: CreateProjectCanvasNoteInput,
  ): Promise<ProjectCanvasNote> {
    const userId = await this.requireCanEdit(input.accountId);
    await this.verifyProject(input.accountId, input.jobId);

    const { data, error } = await this.client
      .from('notes')
      .insert({
        account_id: input.accountId,
        project_id: input.jobId,
        user_id: userId,
        created_by: userId,
        title: input.title.trim(),
        content: input.content,
        category: 'idea',
        tags: [],
        is_pinned: false,
      })
      .select(NOTE_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return toCanvasNote(data as NoteRow, NOTE_DISPLAY_CHARS);
  }

  async updateNote(
    input: UpdateProjectCanvasNoteInput,
  ): Promise<ProjectCanvasNote> {
    await this.requireCanEdit(input.accountId);
    await this.verifyProject(input.accountId, input.jobId);
    const note = await this.requireProjectNote(input);

    const update = this.client
      .from('notes')
      .update({ title: input.title.trim(), content: input.content })
      .eq('id', input.noteId)
      .eq('account_id', input.accountId);
    const scoped =
      note.project_id === input.jobId
        ? update.eq('project_id', input.jobId)
        : update.eq('phase_id', note.phase_id!);
    const { data, error } = await scoped.select(NOTE_COLUMNS).single();
    if (error) throw new Error(error.message);
    return toCanvasNote(data as NoteRow, NOTE_DISPLAY_CHARS);
  }

  async upsert(input: UpsertProjectCanvasItemsInput): Promise<CanvasItem[]> {
    const userId = await this.requireUserId();

    const rows = input.items.map((item) => ({
      id: item.id,
      account_id: input.accountId,
      project_id: input.jobId,
      kind: item.kind,
      ref_id: item.refId,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      z_index: item.zIndex,
      data: item.data,
      updated_by: userId,
    }));

    const { data, error } = await looseClient(this.client)
      .from('project_canvas_items')
      .upsert(rows, {
        onConflict: 'id',
        ignoreDuplicates: input.ignoreExisting ?? false,
      })
      .select(CANVAS_ITEM_COLUMNS);

    if (error) throw new Error(error.message);
    return (data ?? []).map(canvasItemFromRow);
  }

  async delete(input: DeleteProjectCanvasItemsInput): Promise<string[]> {
    await this.requireUserId();

    const { data, error } = await looseClient(this.client)
      .from('project_canvas_items')
      .delete()
      .eq('project_id', input.jobId)
      .eq('account_id', input.accountId)
      .in('id', input.ids)
      .select('id');

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => String(row.id));
  }
}
