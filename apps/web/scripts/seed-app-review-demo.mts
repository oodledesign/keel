#!/usr/bin/env node
/**
 * Fill the App Store review account (appreview@ozer.so) with fictional demo data:
 * a personal space plus Commercial Property, Building Surveyor and Studio workspaces.
 *
 * Re-runnable: demo workspaces are found by slug and their rows are replaced.
 * Personal tasks, notes and people on the review account are replaced too.
 *
 * Usage (from apps/web):
 *   pnpm exec tsx scripts/seed-app-review-demo.mts                       # dry run, local env
 *   pnpm exec tsx scripts/seed-app-review-demo.mts --production --write  # production
 */
import { type SupabaseClient, createClient } from '@supabase/supabase-js';

import { existsSync, readFileSync } from 'node:fs';
import { register } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return {
        shortCircuit: true,
        url: ${JSON.stringify(pathToFileURL(resolve(process.cwd(), 'scripts/stubs/server-only.mjs')).href)},
      };
    }
    if (specifier === '@kit/supabase/server-admin-client') {
      return {
        shortCircuit: true,
        url: 'data:text/javascript,export function getSupabaseServerAdminClient(){throw new Error("Use the script admin client")}',
      };
    }
    return nextResolve(specifier, context);
  }
`),
  pathToFileURL(resolve(process.cwd(), 'scripts/seed-app-review-demo.mts'))
    .href,
);

const REVIEW_EMAIL = 'appreview@ozer.so';
const REVIEW_NAME = 'Alex Morgan';
const TEAMMATE_EMAIL = 'hi+demo-sam@ozer.so';
const TEAMMATE_NAME = 'Sam Carter';
/** Real-data workspace the review account must not see. */
const TEST_SURVEYORS_ACCOUNT_ID = 'c46db291-0e2b-44ed-a71b-ff3f7d703597';

const WORKSPACES = {
  commercial: {
    name: 'Harland Reed Property',
    slug: 'harland-reed-property',
    spaceType: 'commercial-property',
    businessType: null,
  },
  surveyor: {
    name: 'Calloway Building Surveyors',
    slug: 'calloway-building-surveyors',
    spaceType: 'building-surveyor',
    businessType: null,
  },
  studio: {
    name: 'Northfold Studio',
    slug: 'northfold-studio',
    spaceType: 'work',
    businessType: 'other',
  },
} as const;

type WorkspaceKey = keyof typeof WORKSPACES;
type Row = Record<string, unknown>;

const pounds = (value: number) => Math.round(value * 100);

function day(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function at(offsetDays: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function loadEnv(production: boolean) {
  const files = production
    ? ['.env.production.local', '.env.production']
    : ['.env.local', '.env.development', '.env'];
  for (const file of files.map((name) => resolve(process.cwd(), name))) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null || process.env[key] === '') {
        process.env[key] = value;
      }
    }
  }
}

function parseArgs(argv: string[]) {
  return {
    production: argv.includes('--production'),
    write: argv.includes('--write'),
  };
}

async function must<T>(
  label: string,
  promise: PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function insertRows(
  admin: SupabaseClient,
  table: string,
  rows: Row[],
): Promise<Row[]> {
  if (rows.length === 0) return [];
  return must(table, admin.from(table).insert(rows).select('*')) as Promise<
    Row[]
  >;
}

async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureTeammate(admin: SupabaseClient): Promise<string> {
  const existing = await findUserIdByEmail(admin, TEAMMATE_EMAIL);
  const userId =
    existing ??
    (await (async () => {
      const { data, error } = await admin.auth.admin.createUser({
        email: TEAMMATE_EMAIL,
        email_confirm: true,
        user_metadata: { name: TEAMMATE_NAME },
      });
      if (error || !data.user) {
        throw new Error(error?.message ?? 'Could not create demo teammate');
      }
      return data.user.id;
    })());

  await must(
    'teammate name',
    admin.from('accounts').update({ name: TEAMMATE_NAME }).eq('id', userId),
  );
  return userId;
}

async function ensureWorkspace(
  admin: SupabaseClient,
  key: WorkspaceKey,
  ownerId: string,
): Promise<string> {
  const spec = WORKSPACES[key];
  const existing = (await must(
    `find ${spec.slug}`,
    admin
      .from('accounts')
      .select('id, primary_owner_user_id')
      .eq('slug', spec.slug)
      .maybeSingle(),
  )) as { id: string; primary_owner_user_id: string } | null;

  if (existing) {
    if (existing.primary_owner_user_id !== ownerId) {
      throw new Error(
        `Slug ${spec.slug} belongs to another owner; refusing to touch it`,
      );
    }
    return existing.id;
  }

  const created = (await must(
    `create ${spec.slug}`,
    admin.rpc('create_team_account', {
      account_name: spec.name,
      user_id: ownerId,
      account_slug: spec.slug,
      account_space_type: spec.spaceType,
      account_business_type: spec.businessType ?? undefined,
      account_complete_onboarding: true,
    }),
  )) as { id?: string } | null;

  if (!created?.id) throw new Error(`No id returned for ${spec.slug}`);
  return created.id;
}

async function applyWorkspacePlan(
  admin: SupabaseClient,
  key: WorkspaceKey,
  accountId: string,
  grantedBy: string,
) {
  const { findPlanByProductAndPlanId } =
    await import('../lib/billing/ozer-plan-catalog.ts');
  const {
    ensureEstablishedWorkspaceMembersOnboarded,
    seedWorkspaceModulesForProfile,
    syncWorkspaceStateAfterAdminPlan,
  } = await import('../lib/billing/sync-workspace-from-admin-grant.ts');

  await must(
    'billing exempt',
    admin.from('account_billing_exempt').upsert(
      {
        account_id: accountId,
        reason: 'App Store review demo workspace',
        granted_by: grantedBy,
      },
      { onConflict: 'account_id' },
    ),
  );

  if (key === 'surveyor') {
    await seedWorkspaceModulesForProfile(admin, accountId, 'building_surveyor');
    await ensureEstablishedWorkspaceMembersOnboarded(admin, accountId);
    return;
  }

  const [productId, planId] =
    key === 'commercial'
      ? ['ozer-commercial-property', 'commercial-property-monthly']
      : ['ozer-business', 'business-monthly'];
  const plan = findPlanByProductAndPlanId(productId, planId);
  if (!plan) throw new Error(`Plan not found: ${productId}/${planId}`);

  await must(
    'entitlement',
    admin.from('account_entitlements').upsert(
      {
        account_id: accountId,
        entitlement_key: plan.entitlementKey,
        source: 'admin_grant',
        granted_by: grantedBy,
        metadata: { productId, planId, source: 'app_review_demo_seed' },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,entitlement_key' },
    ),
  );
  await syncWorkspaceStateAfterAdminPlan(admin, accountId, plan);
}

async function ensureMember(
  admin: SupabaseClient,
  accountId: string,
  userId: string,
) {
  await must(
    'membership',
    admin
      .from('accounts_memberships')
      .upsert(
        { account_id: accountId, user_id: userId, account_role: 'staff' },
        { onConflict: 'user_id,account_id', ignoreDuplicates: true },
      ),
  );
}

/** Children before parents so foreign keys never block the wipe. */
const WORKSPACE_TABLES = [
  'chat_threads',
  'meeting_action_items',
  'survey_observations',
  'meeting_summaries',
  'meeting_transcripts',
  'invoice_items',
  'invoices',
  'tasks',
  'notes',
  'pipeline_deals',
  'commercial_requirements',
  'commercial_listings',
  'proposals',
  'projects',
  'contacts',
  'clients',
  'finance_transactions',
];

async function wipeWorkspace(admin: SupabaseClient, accountId: string) {
  for (const table of WORKSPACE_TABLES) {
    await must(
      `wipe ${table}`,
      admin.from(table).delete().eq('account_id', accountId),
    );
  }
}

async function wipePersonal(admin: SupabaseClient, userId: string) {
  for (const table of ['tasks', 'notes', 'personal_people']) {
    await must(
      `wipe personal ${table}`,
      admin.from(table).delete().eq('account_id', userId),
    );
  }
}

type ClientSpec = {
  name: string;
  type: 'business' | 'individual';
  role?: 'landlord' | 'tenant' | 'investor' | 'solicitor';
  contact: { first: string; last: string; role?: string };
  phone: string;
  town: string;
};

async function seedClients(
  admin: SupabaseClient,
  accountId: string,
  userId: string,
  specs: ClientSpec[],
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const spec of specs) {
    const email = `${spec.contact.first}.${spec.contact.last}@example.com`
      .toLowerCase()
      .replace(/[^a-z.@]/g, '');
    const [client] = await insertRows(admin, 'clients', [
      {
        account_id: accountId,
        display_name: spec.name,
        client_type: spec.type,
        company_name: spec.type === 'business' ? spec.name : null,
        first_name: spec.type === 'individual' ? spec.contact.first : null,
        last_name: spec.type === 'individual' ? spec.contact.last : null,
        commercial_role: spec.role ?? null,
        email,
        phone: spec.phone,
        city: spec.town,
        country: 'United Kingdom',
        created_by: userId,
      },
    ]);
    const clientId = String(client!.id);
    const [contact] = await insertRows(admin, 'contacts', [
      {
        account_id: accountId,
        client_id: clientId,
        full_name: `${spec.contact.first} ${spec.contact.last}`,
        first_name: spec.contact.first,
        last_name: spec.contact.last,
        company_name: spec.type === 'business' ? spec.name : null,
        role: spec.contact.role ?? null,
        email,
        phone: spec.phone,
      },
    ]);
    await insertRows(admin, 'client_contacts', [
      {
        client_id: clientId,
        contact_id: contact!.id,
        role: spec.contact.role ?? null,
        is_primary: true,
      },
    ]);
    ids.set(spec.name, clientId);
  }
  return ids;
}

type InvoiceSpec = {
  number: string;
  client: string;
  title: string;
  status: 'draft' | 'sent' | 'paid';
  issuedOffset: number;
  dueOffset: number;
  lines: Array<{ description: string; quantity: number; unit: number }>;
  projectId?: string | null;
};

async function seedInvoices(
  admin: SupabaseClient,
  accountId: string,
  userId: string,
  clientIds: Map<string, string>,
  specs: InvoiceSpec[],
) {
  for (const spec of specs) {
    const subtotal = spec.lines.reduce(
      (sum, line) => sum + pounds(line.unit) * line.quantity,
      0,
    );
    const issued = at(spec.issuedOffset, 9);
    const [invoice] = await insertRows(admin, 'invoices', [
      {
        account_id: accountId,
        client_id: clientIds.get(spec.client),
        project_id: spec.projectId ?? null,
        invoice_number: spec.number,
        title: spec.title,
        status: spec.status,
        currency: 'gbp',
        issued_at: spec.status === 'draft' ? null : issued,
        sent_at: spec.status === 'draft' ? null : issued,
        due_at: day(spec.dueOffset),
        paid_at: spec.status === 'paid' ? at(spec.dueOffset - 3, 14) : null,
        subtotal_pence: subtotal,
        total_pence: subtotal,
        amount_paid_pence: spec.status === 'paid' ? subtotal : 0,
        created_by: userId,
      },
    ]);
    await insertRows(
      admin,
      'invoice_items',
      spec.lines.map((line, index) => ({
        account_id: accountId,
        invoice_id: invoice!.id,
        description: line.description,
        quantity: line.quantity,
        unit_price_pence: pounds(line.unit),
        total_pence: pounds(line.unit) * line.quantity,
        sort_order: index,
        line_type: 'quantity',
      })),
    );
  }
}

type TaskSpec = {
  title: string;
  due: number | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'todo' | 'in_progress' | 'done';
  client?: string;
  notes?: string;
};

async function seedTasks(
  admin: SupabaseClient,
  accountId: string,
  userId: string,
  specs: TaskSpec[],
  clientIds = new Map<string, string>(),
) {
  await insertRows(
    admin,
    'tasks',
    specs.map((task, index) => ({
      account_id: accountId,
      user_id: userId,
      title: task.title,
      notes: task.notes ?? null,
      status: task.status ?? 'todo',
      priority: task.priority,
      due_date: task.due == null ? null : day(task.due),
      completed_at: task.status === 'done' ? minutesAgo(90) : null,
      client_id: task.client ? (clientIds.get(task.client) ?? null) : null,
      sort_order: index,
    })),
  );
}

async function seedFinance(
  admin: SupabaseClient,
  accountId: string,
  monthly: Array<{ description: string; pounds: number; dayOfMonth: number }>,
) {
  const rows: Row[] = [];
  const now = new Date();
  for (let back = 5; back >= 0; back -= 1) {
    const growth = 1 + (5 - back) * 0.06;
    for (const entry of monthly) {
      const date = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() - back,
          entry.dayOfMonth,
        ),
      );
      if (date > now) continue;
      const amount = entry.pounds > 0 ? entry.pounds * growth : entry.pounds;
      rows.push({
        account_id: accountId,
        transaction_date: date.toISOString().slice(0, 10),
        amount_pence: pounds(Math.round(amount)),
        description: entry.description,
        source: 'manual',
      });
    }
  }
  await insertRows(admin, 'finance_transactions', rows);
}

async function seedMeeting(
  admin: SupabaseClient,
  input: {
    accountId: string;
    userId: string;
    clientId?: string | null;
    proposalId?: string | null;
    title: string;
    startedAt: string;
    durationSeconds: number;
    segments: Array<{ speaker: string; text: string }>;
    summary?: string;
    actionItems?: Array<{ title: string; due: number; excerpt: string }>;
  },
): Promise<string> {
  const [meeting] = await insertRows(admin, 'meeting_transcripts', [
    {
      account_id: input.accountId,
      client_id: input.clientId ?? null,
      proposal_id: input.proposalId ?? null,
      title: input.title,
      content: input.segments
        .map((segment) => `${segment.speaker}: ${segment.text}`)
        .join('\n\n'),
      speaker_segments: input.segments,
      source: 'desktop_recorder',
      meeting_date: input.startedAt,
      recorded_at: input.startedAt,
      duration_seconds: input.durationSeconds,
      summary_status: input.summary ? 'ready' : 'idle',
      task_extraction_status: input.actionItems ? 'ready' : 'idle',
      created_by: input.userId,
    },
  ]);
  const meetingId = String(meeting!.id);

  if (input.summary) {
    await insertRows(admin, 'meeting_summaries', [
      {
        meeting_transcript_id: meetingId,
        account_id: input.accountId,
        summary_text: input.summary,
        generated_at: new Date().toISOString(),
      },
    ]);
  }

  if (input.actionItems) {
    await insertRows(
      admin,
      'meeting_action_items',
      input.actionItems.map((item) => ({
        meeting_transcript_id: meetingId,
        account_id: input.accountId,
        suggested_title: item.title,
        suggested_assignee_id: input.userId,
        assignee_confidence: 0.9,
        suggested_due_date: day(item.due),
        source_excerpt: item.excerpt,
        status: 'pending_review',
      })),
    );
  }

  return meetingId;
}

async function seedThread(
  admin: SupabaseClient,
  input: {
    accountId: string;
    type: 'direct' | 'group';
    title: string | null;
    reviewerId: string;
    teammateId: string;
    messages: Array<{
      from: 'reviewer' | 'teammate';
      body: string;
      ago: number;
    }>;
    reviewerReadAgo: number;
  },
) {
  const lastAgo = Math.min(...input.messages.map((message) => message.ago));
  const [thread] = await insertRows(admin, 'chat_threads', [
    {
      account_id: input.accountId,
      type: input.type,
      title: input.title,
      created_by: input.teammateId,
      last_message_at: minutesAgo(lastAgo),
    },
  ]);
  await insertRows(admin, 'chat_thread_participants', [
    {
      thread_id: thread!.id,
      participant_kind: 'member',
      participant_user_id: input.reviewerId,
      last_read_at: minutesAgo(input.reviewerReadAgo),
    },
    {
      thread_id: thread!.id,
      participant_kind: 'member',
      participant_user_id: input.teammateId,
      last_read_at: minutesAgo(lastAgo),
    },
  ]);
  await insertRows(
    admin,
    'chat_messages',
    input.messages.map((message) => ({
      thread_id: thread!.id,
      sender_user_id:
        message.from === 'reviewer' ? input.reviewerId : input.teammateId,
      body: message.body,
      created_at: minutesAgo(message.ago),
    })),
  );
  await must(
    'thread last message',
    admin
      .from('chat_threads')
      .update({ last_message_at: minutesAgo(lastAgo) })
      .eq('id', thread!.id),
  );
}

async function seedPersonal(admin: SupabaseClient, userId: string) {
  await seedTasks(admin, userId, userId, [
    { title: 'Book MOT for the car', due: 0, priority: 'high' },
    { title: 'Reschedule dentist appointment', due: -1, priority: 'medium' },
    { title: "Pick up Jess's birthday present", due: 3, priority: 'medium' },
    { title: 'Renew home insurance', due: 6, priority: 'low' },
    { title: 'Pay window cleaner', due: null, priority: 'low', status: 'done' },
  ]);

  await insertRows(admin, 'personal_people', [
    {
      account_id: userId,
      user_id: userId,
      full_name: 'Carol Morgan',
      nickname: 'Mum',
      relationship_label: 'Mum',
      circle_tier: 'core',
      catchup_cadence_days: 7,
      last_catchup_on: day(-4),
    },
    {
      account_id: userId,
      user_id: userId,
      full_name: 'Jess Morgan',
      relationship_label: 'Sister',
      circle_tier: 'close',
      catchup_cadence_days: 14,
      last_catchup_on: day(-10),
      general_notes:
        'Birthday on the 14th. Loves anything from the garden centre.',
    },
    {
      account_id: userId,
      user_id: userId,
      full_name: 'Tom Reilly',
      relationship_label: 'Friend',
      circle_tier: 'friends',
      catchup_cadence_days: 30,
      last_catchup_on: day(-26),
    },
  ]);

  await insertRows(admin, 'notes', [
    {
      account_id: userId,
      user_id: userId,
      created_by: userId,
      title: 'Lake District weekend',
      content:
        'Ideas for the spring trip:\n- Stay near Grasmere\n- Catbells walk on the Saturday\n- Book the boat on Derwentwater',
      category: 'idea',
      is_pinned: true,
    },
  ]);
}

const COMMERCIAL_CLIENTS: ClientSpec[] = [
  {
    name: 'Harrow Lane Estates',
    type: 'business',
    role: 'landlord',
    contact: { first: 'Olivia', last: 'Harrow', role: 'Director' },
    phone: '01622 555 014',
    town: 'Maidstone',
  },
  {
    name: 'Greensand Property Trust',
    type: 'business',
    role: 'investor',
    contact: { first: 'Rachel', last: 'Ingram', role: 'Asset Manager' },
    phone: '01732 555 208',
    town: 'Sevenoaks',
  },
  {
    name: 'Calverley Holdings',
    type: 'business',
    role: 'landlord',
    contact: { first: 'James', last: 'Whitcombe', role: 'Owner' },
    phone: '01892 555 117',
    town: 'Tunbridge Wells',
  },
  {
    name: 'Medway House LLP',
    type: 'business',
    role: 'landlord',
    contact: { first: 'Daniel', last: 'Okafor', role: 'Partner' },
    phone: '01634 555 391',
    town: 'Rochester',
  },
  {
    name: 'Cobtree Logistics',
    type: 'business',
    role: 'tenant',
    contact: { first: 'Priya', last: 'Natarajan', role: 'Operations Director' },
    phone: '01622 555 642',
    town: 'Aylesford',
  },
  {
    name: 'Fenwright Dental Group',
    type: 'business',
    role: 'tenant',
    contact: { first: 'Tom', last: 'Ashdown', role: 'Practice Manager' },
    phone: '01892 555 730',
    town: 'Tunbridge Wells',
  },
  {
    name: 'Ashby & Cole Solicitors',
    type: 'business',
    role: 'solicitor',
    contact: {
      first: 'Helen',
      last: 'Ashby',
      role: 'Commercial Property Partner',
    },
    phone: '01732 555 864',
    town: 'Tonbridge',
  },
];

const LISTINGS = [
  {
    ref: 'HRP-101',
    name: 'Unit 7, Hawthorn Business Park',
    town: 'Maidstone',
    postcode: 'ME16 0XA',
    disposal_type: 'to_let',
    status: 'marketing',
    asking_rent_pence: pounds(38_500),
    size: [4_820, 4_820],
    use_class: 'B8',
    sector: 'industrial',
    summary:
      'Mid-terrace warehouse, 6.5m eaves, two loading doors, 12 parking spaces.',
  },
  {
    ref: 'HRP-102',
    name: '14 Calverley Street',
    town: 'Tunbridge Wells',
    postcode: 'TN1 2XF',
    disposal_type: 'to_let',
    status: 'marketing',
    asking_rent_pence: pounds(27_000),
    size: [1_150, 1_150],
    use_class: 'E',
    sector: 'retail',
    summary: 'Ground floor shop with rear store, 6.1m frontage.',
  },
  {
    ref: 'HRP-103',
    name: 'Second Floor, Medway House',
    town: 'Rochester',
    postcode: 'ME1 1XL',
    disposal_type: 'to_let',
    status: 'under_offer',
    asking_rent_pence: pounds(41_250),
    size: [2_750, 2_750],
    use_class: 'E',
    sector: 'office',
    summary: 'Refurbished open-plan offices, EPC B, eight parking spaces.',
  },
  {
    ref: 'HRP-104',
    name: 'Former Dairy, Oast Lane',
    town: 'Paddock Wood',
    postcode: 'TN12 6XH',
    disposal_type: 'for_sale',
    status: 'marketing',
    asking_price_pence: pounds(1_150_000),
    size: [9_400, 9_400],
    use_class: 'B2',
    sector: 'industrial',
    summary: 'Freehold production building on 0.9 acres with yard.',
  },
  {
    ref: 'HRP-105',
    name: 'Units 2–3, Greensand Court',
    town: 'Sevenoaks',
    postcode: 'TN13 2XT',
    disposal_type: 'to_let',
    status: 'instructed',
    asking_rent_pence: pounds(22_800),
    size: [1_900, 3_800],
    use_class: 'E',
    sector: 'office',
    summary: 'Two self-contained office suites, available together or apart.',
  },
  {
    ref: 'HRP-106',
    name: 'Yard at Crowborough Road',
    town: 'Uckfield',
    postcode: 'TN22 1XP',
    disposal_type: 'to_let',
    status: 'let',
    asking_rent_pence: pounds(18_000),
    size: [21_780, 21_780],
    use_class: 'Sui generis',
    sector: 'land',
    summary: 'Secure hardstanding yard, 0.5 acres, palisade fencing.',
  },
] as const;

async function seedCommercial(
  admin: SupabaseClient,
  accountId: string,
  userId: string,
  teammateId: string,
) {
  const clientIds = await seedClients(
    admin,
    accountId,
    userId,
    COMMERCIAL_CLIENTS,
  );

  const listings = await insertRows(
    admin,
    'commercial_listings',
    LISTINGS.map(({ ref, size, ...listing }) => ({
      ...listing,
      account_id: accountId,
      reference_number: ref,
      address_line_1: listing.name,
      size_min_sqft: size[0],
      size_max_sqft: size[1],
      is_instructed: true,
      on_market_at: listing.status === 'instructed' ? null : at(-21, 9),
    })),
  );
  const listingIdByRef = new Map(
    listings.map((row) => [String(row.reference_number), String(row.id)]),
  );

  await insertRows(admin, 'commercial_requirements', [
    {
      account_id: accountId,
      external_key: 'app-review-r1',
      company_name: 'Cobtree Logistics',
      contact_name: 'Priya Natarajan',
      location_text: 'Maidstone, M20 corridor',
      size_min_sqft: 4_000,
      size_max_sqft: 6_000,
      budget_max_pence: pounds(45_000),
      sector: 'industrial',
      use_class: 'B8',
      tenure: 'rent',
      stage: 'viewing',
    },
    {
      account_id: accountId,
      external_key: 'app-review-r2',
      company_name: 'Fenwright Dental Group',
      contact_name: 'Tom Ashdown',
      location_text: 'Tunbridge Wells town centre',
      size_min_sqft: 1_000,
      size_max_sqft: 1_500,
      budget_max_pence: pounds(30_000),
      sector: 'retail',
      use_class: 'E',
      tenure: 'rent',
      stage: 'actively_searching',
    },
    {
      account_id: accountId,
      external_key: 'app-review-r3',
      company_name: 'Weald Precision Engineering',
      contact_name: 'Marcus Oyelaran',
      location_text: 'Paddock Wood, Tonbridge',
      size_min_sqft: 8_000,
      size_max_sqft: 12_000,
      budget_max_pence: pounds(1_300_000),
      sector: 'industrial',
      use_class: 'B2',
      tenure: 'buy',
      stage: 'negotiating',
    },
  ]);

  const deals = [
    ['HRP-101', 'Harrow Lane Estates', 'current', 5_775],
    ['HRP-102', 'Calverley Holdings', 'current', 4_050],
    ['HRP-103', 'Medway House LLP', 'under_offer', 6_190],
    ['HRP-104', 'Greensand Property Trust', 'negotiating', 17_250],
    ['HRP-105', 'Greensand Property Trust', 'potential', 3_420],
    ['HRP-106', 'Harrow Lane Estates', 'completed', 2_700],
  ] as const;
  await insertRows(
    admin,
    'pipeline_deals',
    deals.map(([ref, client, stage, fee], index) => ({
      account_id: accountId,
      name: client,
      company_name: client,
      stage,
      value: fee,
      work_type: 'agency',
      source: 'referral',
      board_position: index,
      commercial_listing_id: listingIdByRef.get(ref) ?? null,
    })),
  );

  const [project] = await insertRows(admin, 'projects', [
    {
      account_id: accountId,
      client_id: clientIds.get('Harrow Lane Estates'),
      name: 'Hawthorn Business Park lettings',
      description: 'Letting Units 5–9 for Harrow Lane Estates.',
      status: 'in_progress',
      project_type: 'delivery',
      priority: 'high',
      start_date: day(-45),
      target_date: day(40),
      value_pence: pounds(18_500),
      created_by: userId,
    },
    {
      account_id: accountId,
      client_id: clientIds.get('Greensand Property Trust'),
      name: 'Greensand Court rent review',
      description: 'Rent review for the ground floor suites, effective March.',
      status: 'pending',
      project_type: 'delivery',
      priority: 'medium',
      start_date: day(-12),
      target_date: day(60),
      value_pence: pounds(3_200),
      created_by: userId,
    },
  ]);

  await seedTasks(
    admin,
    accountId,
    userId,
    [
      {
        title: 'Send heads of terms to Cobtree Logistics',
        due: 0,
        priority: 'urgent',
        client: 'Cobtree Logistics',
        notes: 'Unit 7: 10-year lease, break at year 5, 6 months rent free.',
      },
      {
        title: 'Call Rachel Ingram about the Greensand Court rent review',
        due: 0,
        priority: 'high',
        client: 'Greensand Property Trust',
      },
      {
        title: 'Book EPC for Former Dairy, Oast Lane',
        due: 0,
        priority: 'medium',
      },
      {
        title: 'Chase Calverley Holdings for signed terms of engagement',
        due: -2,
        priority: 'high',
        client: 'Calverley Holdings',
      },
      {
        title: 'Update Medway House particulars with new floor plans',
        due: 1,
        priority: 'medium',
        client: 'Medway House LLP',
      },
      {
        title: 'Prepare quarterly landlord report for Harrow Lane',
        due: 4,
        priority: 'low',
        client: 'Harrow Lane Estates',
        status: 'in_progress',
      },
      {
        title: 'Upload photos for Units 2–3, Greensand Court',
        due: -1,
        priority: 'medium',
        status: 'done',
      },
    ],
    clientIds,
  );

  await seedMeeting(admin, {
    accountId,
    userId,
    clientId: clientIds.get('Cobtree Logistics'),
    title: 'Viewing: Unit 7, Hawthorn Business Park',
    startedAt: at(0, 9, 30),
    durationSeconds: 1_465,
    segments: [
      {
        speaker: 'Alex Morgan',
        text: 'Thanks for coming out, Priya. This is Unit 7: just over 4,800 square feet, 6.5 metre eaves and two level-access loading doors.',
      },
      {
        speaker: 'Priya Natarajan',
        text: "The eaves height works for our racking. My main question is the yard. We'd have two 7.5 tonne vans in and out most of the day.",
      },
      {
        speaker: 'Alex Morgan',
        text: "The yard is shared with Unit 8 but there's a marked loading area in front of each door. I'll send the site plan with the dimensions.",
      },
      {
        speaker: 'Priya Natarajan',
        text: "Great. If the numbers work we'd want a ten-year lease with a break at five, and some rent free while we fit out.",
      },
      {
        speaker: 'Alex Morgan',
        text: "Understood. I'll take that to the landlord and come back with heads of terms by the end of the week.",
      },
    ],
    summary: [
      '## Summary',
      'Priya Natarajan (Cobtree Logistics) viewed Unit 7, Hawthorn Business Park. The 6.5m eaves suit their racking. Their main concern is yard access for two 7.5t vans.',
      '',
      '## Key points',
      '- Wants a 10-year lease with a tenant break at year 5',
      '- Asking for a rent-free period to cover fit-out',
      '- Needs the yard plan with loading area dimensions',
      '',
      '## Next steps',
      '- Send site plan and yard dimensions to Priya',
      '- Put proposed terms to Harrow Lane Estates',
      '- Issue heads of terms by Friday',
    ].join('\n'),
    actionItems: [
      {
        title: 'Send Unit 7 site plan and yard dimensions to Priya',
        due: 0,
        excerpt: "I'll send the site plan with the dimensions.",
      },
      {
        title: 'Put Cobtree’s proposed terms to Harrow Lane Estates',
        due: 1,
        excerpt: "I'll take that to the landlord",
      },
      {
        title: 'Issue heads of terms for Unit 7',
        due: 3,
        excerpt: 'come back with heads of terms by the end of the week',
      },
    ],
  });

  await seedMeeting(admin, {
    accountId,
    userId,
    clientId: clientIds.get('Greensand Property Trust'),
    title: 'Instruction call: Units 2–3, Greensand Court',
    startedAt: at(-1, 14),
    durationSeconds: 1_080,
    segments: [
      {
        speaker: 'Rachel Ingram',
        text: "We'd like to market both suites together first and split them only if there's no interest after six weeks.",
      },
      {
        speaker: 'Alex Morgan',
        text: "That makes sense. I'd quote £22,800 a year for the pair and get photos done this week.",
      },
    ],
    summary:
      '## Summary\nGreensand Property Trust instructed Harland Reed to market Units 2–3 together at £22,800 pa, splitting after six weeks if needed.\n\n## Next steps\n- Arrange photography\n- Draft particulars for approval',
  });

  await insertRows(admin, 'notes', [
    {
      account_id: accountId,
      user_id: userId,
      created_by: userId,
      client_id: clientIds.get('Harrow Lane Estates'),
      project_id: project!.id,
      title: 'Hawthorn Business Park: landlord preferences',
      content:
        'Olivia is happy to offer up to 6 months rent free on a 10-year term. She would rather avoid tenant breaks before year 5. Service charge is capped at £1.10/sq ft for the first 3 years.',
      category: 'idea',
      is_pinned: true,
    },
  ]);

  await seedInvoices(admin, accountId, userId, clientIds, [
    {
      number: 'HR-1041',
      client: 'Harrow Lane Estates',
      title: 'Letting fee: Yard at Crowborough Road',
      status: 'paid',
      issuedOffset: -34,
      dueOffset: -4,
      lines: [
        {
          description: 'Letting fee (15% of first year rent)',
          quantity: 1,
          unit: 2_700,
        },
      ],
    },
    {
      number: 'HR-1042',
      client: 'Medway House LLP',
      title: 'Letting fee: Second Floor, Medway House',
      status: 'sent',
      issuedOffset: -35,
      dueOffset: -5,
      lines: [
        {
          description: 'Letting fee (15% of first year rent)',
          quantity: 1,
          unit: 6_190,
        },
      ],
    },
    {
      number: 'HR-1043',
      client: 'Greensand Property Trust',
      title: 'Rent review: Greensand Court',
      status: 'sent',
      issuedOffset: -6,
      dueOffset: 24,
      lines: [
        { description: 'Rent review negotiation', quantity: 1, unit: 2_800 },
        { description: 'Comparable evidence report', quantity: 1, unit: 400 },
      ],
    },
    {
      number: 'HR-1044',
      client: 'Calverley Holdings',
      title: 'Marketing costs: 14 Calverley Street',
      status: 'draft',
      issuedOffset: 0,
      dueOffset: 30,
      lines: [
        { description: 'Photography and floor plans', quantity: 1, unit: 450 },
        { description: 'Marketing board', quantity: 1, unit: 185 },
      ],
    },
  ]);

  await seedFinance(admin, accountId, [
    { description: 'Agency fees received', pounds: 14_200, dayOfMonth: 3 },
    {
      description: 'Professional fees received',
      pounds: 4_600,
      dayOfMonth: 18,
    },
    { description: 'Office rent', pounds: -1_850, dayOfMonth: 1 },
    {
      description: 'Property portal subscriptions',
      pounds: -720,
      dayOfMonth: 5,
    },
    { description: 'Photography and boards', pounds: -540, dayOfMonth: 12 },
    { description: 'Software', pounds: -210, dayOfMonth: 20 },
  ]);

  await seedThread(admin, {
    accountId,
    type: 'direct',
    title: null,
    reviewerId: userId,
    teammateId,
    reviewerReadAgo: 60,
    messages: [
      {
        from: 'teammate',
        body: 'Cobtree loved Unit 7. Priya wants the loading bay specs before they make an offer.',
        ago: 190,
      },
      {
        from: 'reviewer',
        body: "Great news. I'll pull the yard depth and door heights from the particulars.",
        ago: 175,
      },
      {
        from: 'teammate',
        body: 'Olivia at Harrow Lane also asked about a joint viewing on Thursday at 11. Does that work?',
        ago: 95,
      },
      {
        from: 'reviewer',
        body: 'Thursday works. Can you confirm with her?',
        ago: 70,
      },
      {
        from: 'teammate',
        body: "Done, it's booked in. I'll send the calendar invite now.",
        ago: 18,
      },
    ],
  });

  await seedThread(admin, {
    accountId,
    type: 'group',
    title: 'Greensand Court rent review',
    reviewerId: userId,
    teammateId,
    reviewerReadAgo: 400,
    messages: [
      {
        from: 'reviewer',
        body: "I've put three comparables together for Greensand Court. Can you sense-check the Sevenoaks ones?",
        ago: 1_500,
      },
      {
        from: 'teammate',
        body: 'Checked. The London Road deal had 9 months rent free, so the headline rent is a bit high. Worth adjusting.',
        ago: 300,
      },
    ],
  });
}

const SURVEYOR_CLIENTS: ClientSpec[] = [
  {
    name: 'Emma Whitfield',
    type: 'individual',
    contact: { first: 'Emma', last: 'Whitfield' },
    phone: '07700 900 412',
    town: 'Tonbridge',
  },
  {
    name: 'Harriet Lowe',
    type: 'individual',
    contact: { first: 'Harriet', last: 'Lowe' },
    phone: '07700 900 538',
    town: 'Tunbridge Wells',
  },
  {
    name: 'Kwame Mensah',
    type: 'individual',
    contact: { first: 'Kwame', last: 'Mensah' },
    phone: '07700 900 761',
    town: 'Edenbridge',
  },
];

type ObservationSpec = {
  section: string;
  rating?: '1' | '2' | '3' | 'NA' | 'NI';
  body: string;
};

async function seedSurvey(
  admin: SupabaseClient,
  input: {
    accountId: string;
    userId: string;
    clientId: string;
    level: 2 | 3;
    address: string;
    postcode: string;
    status: 'draft' | 'sent';
    recipient: string;
    floodBand: 'very_low' | 'low' | 'medium';
    observations: ObservationSpec[];
    session?: { title: string; daysAgo: number; seconds: number };
  },
) {
  const { buildingSurveyBlankHtml, ricsCodeForSectionKey } =
    await import('../lib/building-surveyor/report-sections.ts');

  const [survey] = await insertRows(admin, 'proposals', [
    {
      account_id: input.accountId,
      kind: 'survey_report',
      client_id: input.clientId,
      title: `${input.level === 3 ? 'Level 3 Building Survey' : 'Level 2 HomeBuyer Survey'}: ${input.address}`,
      survey_type: input.level === 3 ? 'rics_hss_l3' : 'rics_hss_l2',
      survey_level: input.level,
      survey_property_address: input.address,
      survey_property_postcode: input.postcode,
      survey_flood_risk_band: input.floodBand,
      survey_flood_source: 'manual',
      survey_flood_risk_summary:
        input.floodBand === 'medium'
          ? 'Medium risk of surface water flooding to the rear garden.'
          : 'Low risk from rivers, the sea and surface water.',
      content_html: buildingSurveyBlankHtml(),
      status: input.status,
      recipient_name: input.recipient,
      currency: 'gbp',
      created_by: input.userId,
    },
  ]);
  const surveyId = String(survey!.id);

  let transcriptId: string | null = null;
  if (input.session) {
    transcriptId = await seedMeeting(admin, {
      accountId: input.accountId,
      userId: input.userId,
      proposalId: surveyId,
      title: input.session.title,
      startedAt: at(-input.session.daysAgo, 10),
      durationSeconds: input.session.seconds,
      segments: input.observations.map((observation) => ({
        speaker: 'Alex Morgan',
        text: observation.body,
      })),
    });
  }

  await insertRows(
    admin,
    'survey_observations',
    input.observations.map((observation, index) => ({
      account_id: input.accountId,
      proposal_id: surveyId,
      transcript_id: transcriptId,
      section_key: observation.section,
      rics_code: ricsCodeForSectionKey(observation.section) ?? null,
      condition_rating: observation.rating ?? null,
      body: observation.body,
      source_body: observation.body,
      cleanup_source: 'ai',
      sort_order: index,
      created_by: input.userId,
    })),
  );
}

async function seedSurveyor(
  admin: SupabaseClient,
  accountId: string,
  userId: string,
) {
  const clientIds = await seedClients(
    admin,
    accountId,
    userId,
    SURVEYOR_CLIENTS,
  );

  await seedSurvey(admin, {
    accountId,
    userId,
    clientId: clientIds.get('Emma Whitfield')!,
    level: 3,
    address: '14 Orchard Rise, Tonbridge',
    postcode: 'TN9 2XQ',
    status: 'draft',
    recipient: 'Emma Whitfield',
    floodBand: 'low',
    session: {
      title: 'Site dictation: 14 Orchard Rise',
      daysAgo: 0,
      seconds: 2_140,
    },
    observations: [
      {
        section: 'weather',
        body: 'Dry and overcast following a period of light rain. Approximately 12°C.',
      },
      {
        section: 'chimney_stacks',
        rating: '3',
        body: 'The rear brick chimney stack leans noticeably and the flaunching is cracked. Mortar joints are badly eroded near the top. Repair is needed soon to stop water getting in and to prevent loose bricks falling.',
      },
      {
        section: 'roof_coverings',
        rating: '2',
        body: 'Concrete interlocking tiles, in fair condition for their age. Several ridge tiles have loose bedding and a few tiles on the rear slope have slipped.',
      },
      {
        section: 'rainwater',
        rating: '2',
        body: 'uPVC gutters and downpipes. The rear gutter is blocked with moss and overflowing at the joint above the kitchen door.',
      },
      {
        section: 'main_walls',
        rating: '2',
        body: 'Cavity brick walls with a damp-proof course visible about 150mm above ground. Some open joints to the side elevation, and soil is piled against the wall near the back door, bridging the DPC.',
      },
      {
        section: 'windows',
        rating: '1',
        body: 'Double-glazed uPVC windows, generally in good order. Opening sections checked worked properly.',
      },
      {
        section: 'outside_doors',
        rating: '1',
        body: 'Composite front door and uPVC rear door, both in satisfactory condition.',
      },
    ],
  });

  await seedSurvey(admin, {
    accountId,
    userId,
    clientId: clientIds.get('Harriet Lowe')!,
    level: 2,
    address: 'Flat 3, 22 Mount Sion, Tunbridge Wells',
    postcode: 'TN1 1XX',
    status: 'draft',
    recipient: 'Harriet Lowe',
    floodBand: 'very_low',
    session: {
      title: 'Site dictation: Flat 3, 22 Mount Sion',
      daysAgo: 2,
      seconds: 1_320,
    },
    observations: [
      {
        section: 'weather',
        body: 'Bright and dry. The inspection took place mid-morning.',
      },
      {
        section: 'main_walls',
        rating: '2',
        body: 'Solid brick walls under a painted render. Hairline cracking to the render on the front elevation, typical of a building of this age.',
      },
      {
        section: 'windows',
        rating: '3',
        body: 'Original single-glazed timber sash windows. Several have rotten bottom rails and two are painted shut. Repair or replacement is needed.',
      },
    ],
  });

  await seedSurvey(admin, {
    accountId,
    userId,
    clientId: clientIds.get('Kwame Mensah')!,
    level: 2,
    address: 'Rose Cottage, Hartfield Road, Edenbridge',
    postcode: 'TN8 5XR',
    status: 'sent',
    recipient: 'Kwame Mensah',
    floodBand: 'medium',
    observations: [
      {
        section: 'roof_coverings',
        rating: '2',
        body: 'Clay plain tiles with moss build-up and some cracked tiles over the porch.',
      },
      {
        section: 'main_walls',
        rating: '1',
        body: 'Brick and tile-hung walls in satisfactory condition.',
      },
    ],
  });

  await insertRows(admin, 'pipeline_deals', [
    {
      account_id: accountId,
      name: 'Kemsing Road survey',
      company_name: 'Laura Pentney',
      stage: 'quoted',
      value: 850,
      work_type: 'professional',
      source: 'website',
      board_position: 0,
    },
    {
      account_id: accountId,
      name: '9 Bishops Down Park',
      company_name: 'Marcus & Ellie Grant',
      stage: 'booked',
      value: 1_150,
      work_type: 'professional',
      source: 'referral',
      board_position: 1,
    },
  ]);

  await seedTasks(
    admin,
    accountId,
    userId,
    [
      {
        title: 'Finish Orchard Rise report and send to Emma',
        due: 1,
        priority: 'high',
        client: 'Emma Whitfield',
      },
      {
        title: 'Check Mount Sion lease for window repair liability',
        due: 0,
        priority: 'medium',
        client: 'Harriet Lowe',
      },
      {
        title: 'Confirm access for 9 Bishops Down Park',
        due: 2,
        priority: 'medium',
      },
    ],
    clientIds,
  );
}

const STUDIO_CLIENTS: ClientSpec[] = [
  {
    name: 'Brightwater Coffee Co.',
    type: 'business',
    contact: { first: 'Leah', last: 'Brightwater', role: 'Founder' },
    phone: '020 7946 0182',
    town: 'London',
  },
  {
    name: 'Ellis & Finch Architects',
    type: 'business',
    contact: { first: 'Owen', last: 'Ellis', role: 'Director' },
    phone: '01273 555 304',
    town: 'Brighton',
  },
  {
    name: 'Kestrel Outdoor',
    type: 'business',
    contact: { first: 'Nadia', last: 'Shah', role: 'Marketing Lead' },
    phone: '0161 555 0427',
    town: 'Manchester',
  },
];

async function seedStudio(
  admin: SupabaseClient,
  accountId: string,
  userId: string,
) {
  const clientIds = await seedClients(admin, accountId, userId, STUDIO_CLIENTS);

  const projects = await insertRows(admin, 'projects', [
    {
      account_id: accountId,
      client_id: clientIds.get('Brightwater Coffee Co.'),
      name: 'Brightwater rebrand',
      description: 'New identity, packaging and signage for three cafés.',
      status: 'in_progress',
      project_type: 'delivery',
      priority: 'high',
      start_date: day(-30),
      target_date: day(21),
      value_pence: pounds(9_600),
      created_by: userId,
    },
    {
      account_id: accountId,
      client_id: clientIds.get('Ellis & Finch Architects'),
      name: 'Ellis & Finch website',
      description: 'Portfolio site with a project case-study template.',
      status: 'in_progress',
      project_type: 'delivery',
      priority: 'medium',
      start_date: day(-8),
      target_date: day(50),
      value_pence: pounds(7_200),
      created_by: userId,
    },
    {
      account_id: accountId,
      client_id: clientIds.get('Kestrel Outdoor'),
      name: 'Kestrel spring campaign',
      description: 'Social and email campaign for the spring range.',
      status: 'pending',
      project_type: 'campaign',
      start_date: day(14),
      target_date: day(75),
      value_pence: pounds(4_500),
      created_by: userId,
    },
  ]);
  const brightwater = projects.find((p) => p.name === 'Brightwater rebrand');

  await seedTasks(
    admin,
    accountId,
    userId,
    [
      {
        title: 'Present Brightwater logo routes',
        due: 0,
        priority: 'high',
        client: 'Brightwater Coffee Co.',
      },
      {
        title: 'Send Ellis & Finch sitemap for sign-off',
        due: -1,
        priority: 'medium',
        client: 'Ellis & Finch Architects',
      },
      {
        title: 'Brief photographer for Kestrel shoot',
        due: 5,
        priority: 'low',
        client: 'Kestrel Outdoor',
      },
    ],
    clientIds,
  );

  await seedInvoices(admin, accountId, userId, clientIds, [
    {
      number: 'NF-2031',
      client: 'Brightwater Coffee Co.',
      title: 'Rebrand: discovery and strategy',
      status: 'paid',
      issuedOffset: -28,
      dueOffset: -14,
      projectId: brightwater ? String(brightwater.id) : null,
      lines: [
        {
          description: 'Discovery workshop and brand strategy',
          quantity: 1,
          unit: 4_800,
        },
      ],
    },
    {
      number: 'NF-2032',
      client: 'Ellis & Finch Architects',
      title: 'Website: deposit',
      status: 'sent',
      issuedOffset: -4,
      dueOffset: 10,
      lines: [{ description: '30% project deposit', quantity: 1, unit: 2_160 }],
    },
    {
      number: 'NF-2033',
      client: 'Kestrel Outdoor',
      title: 'Campaign planning day',
      status: 'sent',
      issuedOffset: -21,
      dueOffset: -7,
      lines: [{ description: 'Planning workshop', quantity: 1, unit: 1_250 }],
    },
  ]);

  await seedFinance(admin, accountId, [
    { description: 'Client payments', pounds: 8_900, dayOfMonth: 8 },
    { description: 'Studio rent', pounds: -950, dayOfMonth: 1 },
    { description: 'Freelance illustrator', pounds: -1_200, dayOfMonth: 15 },
    { description: 'Software subscriptions', pounds: -180, dayOfMonth: 22 },
  ]);
}

async function main() {
  const { production, write } = parseArgs(process.argv.slice(2));
  loadEnv(production);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  }

  const host = new URL(url).hostname;
  const isLocal = ['localhost', '127.0.0.1'].includes(host);
  if (!isLocal && !production) {
    throw new Error(`Refusing to write to ${host} without --production`);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const reviewerId = await findUserIdByEmail(admin, REVIEW_EMAIL);
  if (!reviewerId) throw new Error(`${REVIEW_EMAIL} not found on ${host}`);

  console.log(
    `${write ? 'Seeding' : 'Dry run against'} ${host} for ${REVIEW_EMAIL}`,
  );
  if (!write) {
    console.log('Re-run with --write to apply.');
    return;
  }

  await must(
    'reviewer name',
    admin.from('accounts').update({ name: REVIEW_NAME }).eq('id', reviewerId),
  );
  const { error: metadataError } = await admin.auth.admin.updateUserById(
    reviewerId,
    { user_metadata: { name: REVIEW_NAME } },
  );
  if (metadataError) {
    throw new Error(`reviewer metadata: ${metadataError.message}`);
  }

  await must(
    'leave Test Surveyors',
    admin
      .from('accounts_memberships')
      .delete()
      .eq('account_id', TEST_SURVEYORS_ACCOUNT_ID)
      .eq('user_id', reviewerId),
  );

  const teammateId = await ensureTeammate(admin);

  const ids = {} as Record<WorkspaceKey, string>;
  for (const workspaceKey of Object.keys(WORKSPACES) as WorkspaceKey[]) {
    ids[workspaceKey] = await ensureWorkspace(admin, workspaceKey, reviewerId);
    await wipeWorkspace(admin, ids[workspaceKey]);
  }
  await ensureMember(admin, ids.commercial, teammateId);

  for (const workspaceKey of Object.keys(WORKSPACES) as WorkspaceKey[]) {
    await applyWorkspacePlan(
      admin,
      workspaceKey,
      ids[workspaceKey],
      reviewerId,
    );
  }

  await wipePersonal(admin, reviewerId);
  await seedPersonal(admin, reviewerId);
  console.log('Personal space seeded');

  await seedCommercial(admin, ids.commercial, reviewerId, teammateId);
  console.log(`${WORKSPACES.commercial.name} seeded`);

  await seedSurveyor(admin, ids.surveyor, reviewerId);
  console.log(`${WORKSPACES.surveyor.name} seeded`);

  await seedStudio(admin, ids.studio, reviewerId);
  console.log(`${WORKSPACES.studio.name} seeded`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
