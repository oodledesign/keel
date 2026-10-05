import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import {
  type CanvasProject,
  loadCanvasProject,
  loadCanvasRows,
  mapCanvasRow,
} from './canvas';
import {
  CANVAS_DEFAULT_SIZES,
  CANVAS_ITEM_COLUMNS,
  type CanvasBox,
  type CanvasRow,
  canvasContentBounds,
  flowPlacements,
  isConnectorKind,
  isContainerKind,
  nextZIndexes,
  pickConnectorHandles,
  rowBox,
  rowData,
} from './canvas-shared';
import { assertSupabaseOk, toolJson } from './shared';
import type { OzerMcpToolRegistrar } from './types';

const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);

export const CARD_KINDS = ['task', 'phase', 'note'] as const;
type CardKind = (typeof CARD_KINDS)[number];

const cardSchema = z.object({
  kind: z.enum(CARD_KINDS),
  ref_id: z.string().uuid().describe('The task, phase or note id.'),
  x: coordinate.optional(),
  y: coordinate.optional(),
});

export const placeCanvasCardsSchema = z.object({
  project_id: z.string().uuid(),
  cards: z.array(cardSchema).min(1).max(50),
});

export const deleteCanvasItemsSchema = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1)
    .max(100)
    .describe('Canvas item ids from get_project_canvas.'),
});

export const linkTasksSchema = z.object({
  project_id: z.string().uuid(),
  links: z
    .array(
      z.object({
        prerequisite_task_id: z
          .string()
          .uuid()
          .describe('The task that has to happen first.'),
        dependent_task_id: z
          .string()
          .uuid()
          .describe('The task that waits for the prerequisite.'),
        label: z.string().trim().max(60).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export const addCanvasCommentSchema = z
  .object({
    project_id: z.string().uuid(),
    task_id: z.string().uuid().optional(),
    phase_id: z.string().uuid().optional(),
    note_id: z.string().uuid().optional(),
    item_id: z
      .string()
      .uuid()
      .optional()
      .describe('A canvas item id, if not commenting on a task/phase/note.'),
    body: z.string().trim().min(1).max(4000),
    mention_user_ids: z.array(z.string().uuid()).max(20).optional(),
    mention_names: z
      .array(z.string().trim().min(1).max(80))
      .max(20)
      .optional()
      .describe(
        'First names, full names or emails of workspace members to notify (e.g. "Paul"). Must match exactly one person each.',
      ),
  })
  .refine(
    (v) =>
      [v.task_id, v.phase_id, v.note_id, v.item_id].filter(Boolean).length ===
      1,
    'Provide exactly one of task_id, phase_id, note_id or item_id.',
  );

export const listCanvasCommentsSchema = z.object({
  project_id: z.string().uuid(),
  task_id: z.string().uuid().optional(),
  phase_id: z.string().uuid().optional(),
  note_id: z.string().uuid().optional(),
  item_id: z.string().uuid().optional(),
});

/** Which connector ids point at the given items (either end). */
export function connectorsTouching(
  rows: Array<Pick<CanvasRow, 'id' | 'kind' | 'data'>>,
  ids: Set<string>,
) {
  return rows
    .filter((row) => isConnectorKind(row.kind))
    .filter((row) => {
      const data = rowData(row);
      return (
        (data.source && ids.has(data.source)) ||
        (data.target && ids.has(data.target))
      );
    })
    .map((row) => row.id);
}

/** Case-insensitive match of a mention token against workspace people. */
export function matchPerson<
  T extends { id: string; name: string | null; email: string | null },
>(people: T[], token: string): T {
  const needle = token.trim().toLowerCase();
  const exact = people.filter(
    (p) =>
      p.name?.trim().toLowerCase() === needle ||
      p.email?.trim().toLowerCase() === needle,
  );
  const matches =
    exact.length > 0
      ? exact
      : people.filter(
          (p) =>
            p.name
              ?.trim()
              .toLowerCase()
              .split(/\s+/)
              .some((part) => part === needle) ||
            p.email?.trim().toLowerCase().startsWith(`${needle}@`),
        );
  if (matches.length === 1) return matches[0] as T;
  if (matches.length === 0) {
    throw new Error(`No workspace member matches "${token}".`);
  }
  throw new Error(
    `"${token}" matches several people (${matches
      .map((m) => m.name ?? m.email ?? m.id)
      .join(', ')}). Use mention_user_ids or a fuller name.`,
  );
}

async function assertRefsBelong(
  supabase: SupabaseClient,
  project: CanvasProject,
  cards: Array<{ kind: CardKind; ref_id: string }>,
) {
  for (const kind of CARD_KINDS) {
    const ids = [
      ...new Set(cards.filter((c) => c.kind === kind).map((c) => c.ref_id)),
    ];
    if (ids.length === 0) continue;
    const table = { task: 'tasks', phase: 'project_phases', note: 'notes' }[
      kind
    ];
    const projectColumn = kind === 'note' ? 'account_id' : 'project_id';
    const { data, error } = await supabase
      .from(table)
      .select(`id, ${projectColumn}`)
      .in('id', ids);
    assertSupabaseOk(data, error, `check ${kind} cards`);
    const found = new Map(
      ((data ?? []) as unknown as Array<Record<string, string | null>>).map(
        (r) => [r.id as string, r[projectColumn]],
      ),
    );
    for (const id of ids) {
      const owner = found.get(id);
      const expected = kind === 'note' ? project.account_id : project.id;
      if (owner === undefined) throw new Error(`${kind} ${id} not found`);
      if (owner !== expected) {
        throw new Error(
          kind === 'note'
            ? `note ${id} is in a different workspace`
            : `${kind} ${id} is not part of this project`,
        );
      }
    }
  }
}

type Want = { kind: CardKind; ref_id: string; x?: number; y?: number };

/**
 * Make sure each card is on the canvas. New cards go where asked, or flow in
 * below existing content; existing cards are only moved when x/y is given.
 */
export async function ensureCanvasCards(
  supabase: SupabaseClient,
  userId: string,
  project: CanvasProject,
  rows: CanvasRow[],
  wants: Want[],
) {
  await assertRefsBelong(supabase, project, wants);

  const keyOf = (kind: string, ref: string) => `${kind}:${ref}`;
  const byRef = new Map(
    rows
      .filter((r) => r.ref_id)
      .map((r) => [keyOf(r.kind, r.ref_id as string), r]),
  );

  const unique = new Map<string, Want>();
  for (const want of wants) {
    const key = keyOf(want.kind, want.ref_id);
    const prev = unique.get(key);
    unique.set(key, { ...prev, ...want });
  }

  const moves: Array<{ id: string; x: number; y: number }> = [];
  const fresh: Want[] = [];
  for (const [key, want] of unique) {
    const existing = byRef.get(key);
    if (existing) {
      if (want.x !== undefined && want.y !== undefined) {
        moves.push({ id: existing.id, x: want.x, y: want.y });
      }
    } else {
      fresh.push(want);
    }
  }

  for (const want of fresh) {
    if ((want.x === undefined) !== (want.y === undefined)) {
      throw new Error(`${want.kind} ${want.ref_id}: give both x and y.`);
    }
  }

  for (const move of moves) {
    const { error } = await supabase
      .from('project_canvas_items')
      .update({ x: move.x, y: move.y, updated_by: userId })
      .eq('id', move.id);
    assertSupabaseOk(null, error, 'move canvas card');
  }

  const sizeOf = (kind: string) =>
    CANVAS_DEFAULT_SIZES[kind] ?? { w: 260, h: 100 };
  const auto = fresh.filter((w) => w.x === undefined);
  const flowBounds = canvasContentBounds(rows);
  const flow = flowPlacements(
    auto.map((w) => sizeOf(w.kind)),
    flowBounds,
  );
  const z = nextZIndexes(rows);
  let autoIndex = 0;
  let containerZ = z.container;
  let itemZ = z.item;

  const inserts = fresh.map((want) => {
    const size = sizeOf(want.kind);
    const pos =
      want.x !== undefined
        ? { x: want.x, y: want.y as number }
        : (flow[autoIndex++] as { x: number; y: number });
    return {
      id: crypto.randomUUID(),
      account_id: project.account_id,
      project_id: project.id,
      kind: want.kind,
      ref_id: want.ref_id,
      x: pos.x,
      y: pos.y,
      w: size.w,
      h: size.h,
      z_index: isContainerKind(want.kind) ? containerZ++ : itemZ++,
      data: {},
      updated_by: userId,
    };
  });

  let created: CanvasRow[] = [];
  if (inserts.length > 0) {
    const { data, error } = await supabase
      .from('project_canvas_items')
      .insert(inserts)
      .select(CANVAS_ITEM_COLUMNS);
    assertSupabaseOk(data, error, 'place canvas cards');
    created = (data ?? []) as CanvasRow[];
  }

  const cardIds = new Map<string, string>();
  for (const [key, row] of byRef) cardIds.set(key, row.id);
  for (const row of created) {
    cardIds.set(keyOf(row.kind, row.ref_id as string), row.id);
  }
  return { cardIds, created, moved: moves.length };
}

async function resolveTargetItem(
  supabase: SupabaseClient,
  userId: string,
  project: CanvasProject,
  input: {
    task_id?: string;
    phase_id?: string;
    note_id?: string;
    item_id?: string;
  },
): Promise<string> {
  if (input.item_id) return input.item_id;
  const kind: CardKind = input.task_id
    ? 'task'
    : input.phase_id
      ? 'phase'
      : 'note';
  const ref = (input.task_id ?? input.phase_id ?? input.note_id) as string;
  const rows = await loadCanvasRows(supabase, project.id);
  const { cardIds } = await ensureCanvasCards(supabase, userId, project, rows, [
    { kind, ref_id: ref },
  ]);
  return cardIds.get(`${kind}:${ref}`) as string;
}

async function loadPeople(supabase: SupabaseClient, accountId: string) {
  const { data: members, error } = await supabase
    .from('accounts_memberships')
    .select('user_id')
    .eq('account_id', accountId);
  assertSupabaseOk(members, error, 'load workspace members');
  const ids = ((members ?? []) as Array<{ user_id: string }>).map(
    (m) => m.user_id,
  );
  if (ids.length === 0) return [];
  const { data, error: peopleError } = await supabase
    .from('accounts')
    .select('id, name, email')
    .in('id', ids);
  assertSupabaseOk(data, peopleError, 'load member names');
  return (data ?? []) as Array<{
    id: string;
    name: string | null;
    email: string | null;
  }>;
}

export const registerCanvasCardTools: OzerMcpToolRegistrar = (
  server,
  context,
) => {
  const { supabase, userId } = context;

  server.registerTool(
    'place_canvas_cards',
    {
      description:
        "Put task, phase or note cards on a delivery project's canvas at exact positions, or move ones already there. Cards not yet on the canvas are created at x/y (canvas px, y grows downward; tasks are 280×76, phases 320×260, notes 260×140). Omit x/y to flow new cards below existing content. Existing cards only move when x and y are both given. Use this before link_tasks or add_canvas_comment if you want to control where the cards sit.",
      inputSchema: placeCanvasCardsSchema,
    },
    async (input) => {
      const project = await loadCanvasProject(
        supabase,
        input.project_id,
        'edit',
      );
      const rows = await loadCanvasRows(supabase, project.id);
      const { cardIds, created, moved } = await ensureCanvasCards(
        supabase,
        userId,
        project,
        rows,
        input.cards,
      );
      return toolJson({
        created_count: created.length,
        moved_count: moved,
        cards: input.cards.map((c) => ({
          kind: c.kind,
          ref_id: c.ref_id,
          item_id: cardIds.get(`${c.kind}:${c.ref_id}`) ?? null,
        })),
        items: created.map((row) => mapCanvasRow(row)),
      });
    },
  );

  server.registerTool(
    'delete_canvas_items',
    {
      description:
        'Remove items from a project canvas (stickies, text, shapes, frames, links, drawings, arrows, or linked cards). Arrows attached to a removed item go with it. Removing a task, phase or note CARD only takes it off the canvas; the task/phase/note itself is kept (use delete_tasks / delete_project_phase / delete_note for that). Items inside a deleted frame stay where they are. Cannot be undone.',
      inputSchema: deleteCanvasItemsSchema,
    },
    async (input) => {
      const ids = [...new Set(input.ids)];
      const { data, error } = await supabase
        .from('project_canvas_items')
        .select('id, project_id, kind, data')
        .in('id', ids);
      assertSupabaseOk(data, error, 'load canvas items');
      const rows = (data ?? []) as Array<
        Pick<CanvasRow, 'id' | 'kind' | 'data'> & { project_id: string }
      >;
      const found = new Set(rows.map((r) => r.id));
      const projectIds = [...new Set(rows.map((r) => r.project_id))];
      const toDelete = new Set(ids.filter((id) => found.has(id)));

      for (const projectId of projectIds) {
        await loadCanvasProject(supabase, projectId, 'edit');
        const { data: siblings, error: siblingError } = await supabase
          .from('project_canvas_items')
          .select('id, kind, data')
          .eq('project_id', projectId)
          .eq('kind', 'connector');
        assertSupabaseOk(siblings, siblingError, 'load connectors');
        for (const id of connectorsTouching(
          (siblings ?? []) as Array<Pick<CanvasRow, 'id' | 'kind' | 'data'>>,
          new Set(ids),
        )) {
          toDelete.add(id);
        }
      }

      if (toDelete.size > 0) {
        const { error: deleteError } = await supabase
          .from('project_canvas_items')
          .delete()
          .in('id', [...toDelete]);
        assertSupabaseOk(null, deleteError, 'delete canvas items');
      }

      return toolJson({
        deleted_count: toDelete.size,
        deleted: [...toDelete],
        not_found: ids.filter((id) => !found.has(id)),
      });
    },
  );

  server.registerTool(
    'link_tasks',
    {
      description:
        'Record task dependencies on a project canvas: an arrow from the prerequisite task to the task that waits for it (e.g. "content calendar" waits for "strategy"). Both tasks must belong to the project; their cards are added to the canvas if missing (use place_canvas_cards first to choose where). Existing identical links are skipped. Remove a dependency with delete_canvas_items on the arrow id.',
      inputSchema: linkTasksSchema,
    },
    async (input) => {
      const project = await loadCanvasProject(
        supabase,
        input.project_id,
        'edit',
      );
      const rows = await loadCanvasRows(supabase, project.id);

      for (const link of input.links) {
        if (link.prerequisite_task_id === link.dependent_task_id) {
          throw new Error('A task cannot depend on itself.');
        }
      }

      const wants: Want[] = input.links.flatMap((l) => [
        { kind: 'task' as const, ref_id: l.prerequisite_task_id },
        { kind: 'task' as const, ref_id: l.dependent_task_id },
      ]);
      const { cardIds, created } = await ensureCanvasCards(
        supabase,
        userId,
        project,
        rows,
        wants,
      );

      const all = [...rows, ...created];
      const boxById = new Map<string, CanvasBox>(
        all
          .filter((r) => !isConnectorKind(r.kind))
          .map((r) => [r.id, rowBox(r)]),
      );
      const existing = new Set(
        rows
          .filter((r) => isConnectorKind(r.kind))
          .map((r) => `${rowData(r).source}>${rowData(r).target}`),
      );

      const inserts: Array<Record<string, unknown>> = [];
      const skipped: string[] = [];
      for (const link of input.links) {
        const source = cardIds.get(`task:${link.prerequisite_task_id}`);
        const target = cardIds.get(`task:${link.dependent_task_id}`);
        if (!source || !target) continue;
        const key = `${source}>${target}`;
        if (existing.has(key)) {
          skipped.push(key);
          continue;
        }
        existing.add(key);
        const handles =
          boxById.get(source) && boxById.get(target)
            ? pickConnectorHandles(
                boxById.get(source) as CanvasBox,
                boxById.get(target) as CanvasBox,
              )
            : { sourceHandle: 'right', targetHandle: 'left' };
        inserts.push({
          id: crypto.randomUUID(),
          account_id: project.account_id,
          project_id: project.id,
          kind: 'connector',
          ref_id: null,
          x: 0,
          y: 0,
          w: null,
          h: null,
          z_index: 0,
          data: {
            source,
            target,
            ...handles,
            color: 'slate',
            label: link.label ?? 'then',
          },
          updated_by: userId,
        });
      }

      let arrows: CanvasRow[] = [];
      if (inserts.length > 0) {
        const { data, error } = await supabase
          .from('project_canvas_items')
          .insert(inserts)
          .select(CANVAS_ITEM_COLUMNS);
        assertSupabaseOk(data, error, 'link tasks');
        arrows = (data ?? []) as CanvasRow[];
      }

      return toolJson({
        linked_count: arrows.length,
        skipped_existing: skipped.length,
        cards_added: created.length,
        arrows: arrows.map((row) => mapCanvasRow(row)),
      });
    },
  );

  server.registerTool(
    'add_canvas_comment',
    {
      description:
        'Comment on a task, phase, note or canvas item in a project, and notify people. The comment sits on the item\'s canvas card (created if missing) and shows in the canvas comment thread. Mention teammates with mention_names (e.g. "Paul", "Louise") or mention_user_ids; each mentioned workspace member gets an in-app notification linking to the card.',
      inputSchema: addCanvasCommentSchema,
    },
    async (input) => {
      const project = await loadCanvasProject(
        supabase,
        input.project_id,
        'view',
      );

      const mentions = new Set(input.mention_user_ids ?? []);
      if (input.mention_names?.length) {
        const people = await loadPeople(supabase, project.account_id);
        for (const name of input.mention_names) {
          mentions.add(matchPerson(people, name).id);
        }
      }

      const itemId = await resolveTargetItem(supabase, userId, project, input);

      const { data, error } = await supabase.rpc('add_project_canvas_comment', {
        p_project_id: project.id,
        p_item_id: itemId,
        p_body: input.body,
        p_mentions: [...mentions],
      });
      assertSupabaseOk(data, error, 'add canvas comment');

      return toolJson({
        comment_id: data,
        item_id: itemId,
        notified_user_ids: [...mentions].filter((id) => id !== userId),
      });
    },
  );

  server.registerTool(
    'list_canvas_comments',
    {
      description:
        "List comments on a project canvas, oldest first. Pass task_id, phase_id, note_id or item_id to see one card's thread; omit them for every comment in the project.",
      inputSchema: listCanvasCommentsSchema,
    },
    async (input) => {
      const project = await loadCanvasProject(
        supabase,
        input.project_id,
        'view',
      );
      let itemIds: string[] | null = null;
      const ref = input.task_id
        ? { kind: 'task', id: input.task_id }
        : input.phase_id
          ? { kind: 'phase', id: input.phase_id }
          : input.note_id
            ? { kind: 'note', id: input.note_id }
            : null;
      if (input.item_id) itemIds = [input.item_id];
      else if (ref) {
        const rows = await loadCanvasRows(supabase, project.id);
        itemIds = rows
          .filter((r) => r.kind === ref.kind && r.ref_id === ref.id)
          .map((r) => r.id);
        if (itemIds.length === 0) return toolJson({ comments: [] });
      }

      let query = supabase
        .from('project_canvas_comments')
        .select(
          'id, item_id, body, mentions, author_id, resolved_at, created_at',
        )
        .eq('project_id', project.id)
        .order('created_at', { ascending: true })
        .limit(500);
      if (itemIds) query = query.in('item_id', itemIds);
      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list canvas comments');
      return toolJson({ comments: data ?? [] });
    },
  );
};
