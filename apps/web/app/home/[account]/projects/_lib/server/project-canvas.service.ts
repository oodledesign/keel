import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

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
  DeleteProjectCanvasItemsInput,
  LoadProjectCanvasInput,
  ProjectCanvasNote,
  UpsertProjectCanvasItemsInput,
} from '../schema/project-canvas.schema';

const CANVAS_ITEM_COLUMNS =
  'id, kind, ref_id, x, y, w, h, z_index, data, updated_at, updated_by';

export type ProjectCanvasSnapshot = {
  /** False until the canvas migration is applied. */
  available: boolean;
  items: CanvasItem[];
  notes: ProjectCanvasNote[];
};

function notePreview(content: string | null) {
  return (content ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[#*_>`~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
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
    await this.requireUserId();
    await this.verifyProject(input.accountId, input.jobId);

    const [itemsResult, notes] = await Promise.all([
      looseClient(this.client)
        .from('project_canvas_items')
        .select(CANVAS_ITEM_COLUMNS)
        .eq('project_id', input.jobId)
        .eq('account_id', input.accountId)
        .order('created_at', { ascending: true }),
      this.loadNotes(input),
    ]);

    if (itemsResult.error) {
      if (isMissingRelationError(itemsResult.error)) {
        logMissingRelation('project_canvas.load', itemsResult.error);
        return { available: false, items: [], notes };
      }
      throw new Error(itemsResult.error.message);
    }

    return {
      available: true,
      items: (itemsResult.data ?? []).map(canvasItemFromRow),
      notes,
    };
  }

  private async loadNotes(
    input: LoadProjectCanvasInput,
  ): Promise<ProjectCanvasNote[]> {
    const { data: phases, error: phasesError } = await this.client
      .from('project_phases')
      .select('id')
      .eq('account_id', input.accountId)
      .eq('project_id', input.jobId);
    if (phasesError) throw new Error(phasesError.message);

    const phaseIds = (phases ?? []).map((phase) => phase.id);
    const filter =
      phaseIds.length > 0
        ? `project_id.eq.${input.jobId},phase_id.in.(${phaseIds.join(',')})`
        : `project_id.eq.${input.jobId}`;

    const { data, error } = await this.client
      .from('notes')
      .select('id, title, content, phase_id, is_pinned, updated_at')
      .eq('account_id', input.accountId)
      .or(filter)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    return (data ?? []).map((note) => ({
      id: note.id,
      title: note.title,
      preview: notePreview(note.content),
      phaseId: note.phase_id,
      isPinned: note.is_pinned,
      updatedAt: note.updated_at,
    }));
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
