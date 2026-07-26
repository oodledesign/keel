import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  loadPublicSupportOrgByToken,
  loadPublicSupportTicketByToken,
} from '~/lib/support/public-support.service';

export const runtime = 'nodejs';

const BUCKET = 'support-attachments';
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

function safeSegment(name: string) {
  return name.replace(/[/\\]/g, '_').replace(/\.\./g, '_').trim().slice(0, 180);
}

async function orgBelongsToProviderAccount(
  businessId: string | null | undefined,
  providerAccountId: string,
): Promise<boolean> {
  if (!businessId) return false;
  if (businessId === providerAccountId) return true;

  const admin = getSupabaseServerAdminClient();
  const { data: business } = await admin
    .from('businesses')
    .select('account_id')
    .eq('id', businessId)
    .maybeSingle();

  return (
    (business as { account_id?: string | null } | null)?.account_id ===
    providerAccountId
  );
}

async function assertAccountMembership(accountId: string, userId: string) {
  const client = getSupabaseServerClient();

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membership) return true;

  const { data: portalMember } = await client
    .from('client_members')
    .select('id, client_org_id')
    .eq('user_id', userId)
    .limit(50);

  if (portalMember?.length) {
    const orgIds = portalMember.map(
      (row) => (row as { client_org_id: string }).client_org_id,
    );

    const { data: orgs } = await client
      .from('client_orgs')
      .select('id, business_id')
      .in('id', orgIds);

    for (const org of orgs ?? []) {
      const row = org as {
        business_id?: string | null;
      };
      if (await orgBelongsToProviderAccount(row.business_id, accountId)) {
        return true;
      }
    }
  }

  // Linked workspace (partner) members may upload to the provider account.
  const { data: userMemberships } = await client
    .from('accounts_memberships')
    .select('account_id')
    .eq('user_id', userId);

  const linkedAccountIds = (userMemberships ?? []).map(
    (row) => (row as { account_id: string }).account_id,
  );

  if (linkedAccountIds.length > 0) {
    const admin = getSupabaseServerAdminClient();
    // Table may be missing from generated Database types until typegen.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sharesClient = admin as any;
    const { data: shares } = await sharesClient
      .from('client_workspace_shares')
      .select('client_org_id')
      .in('guest_account_id', linkedAccountIds)
      .eq('status', 'active')
      .eq('can_support', true);

    const sharedOrgIds = ((shares ?? []) as Array<{ client_org_id?: string }>)
      .map((row) => row.client_org_id)
      .filter((id): id is string => Boolean(id));

    if (sharedOrgIds.length > 0) {
      const { data: linkedOrgs } = await admin
        .from('client_orgs')
        .select('id, business_id')
        .in('id', sharedOrgIds);

      for (const org of linkedOrgs ?? []) {
        const row = org as { business_id?: string | null };
        if (await orgBelongsToProviderAccount(row.business_id, accountId)) {
          return true;
        }
      }
    }
  }

  return false;
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const supportToken = String(formData.get('supportToken') ?? '').trim();
  const accountId = String(formData.get('accountId') ?? '').trim();
  const platformSupport =
    String(formData.get('platformSupport') ?? '').trim() === '1';
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: 'Only images and PDFs are allowed' },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File is too large. Max size is 10MB.' },
      { status: 400 },
    );
  }

  let resolvedAccountId = accountId;

  if (supportToken) {
    const org = await loadPublicSupportOrgByToken(supportToken);
    if (org) {
      resolvedAccountId = org.accountId;
    } else {
      const ticket = await loadPublicSupportTicketByToken(supportToken);
      if (!ticket) {
        return NextResponse.json(
          { error: 'Invalid support link' },
          { status: 403 },
        );
      }
      resolvedAccountId = ticket.accountId;
    }
  } else if (platformSupport) {
    const userClient = getSupabaseServerClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Super admins and ticket authors upload under a stable platform prefix.
    resolvedAccountId = `platform/${user.id}`;
  } else {
    const userClient = getSupabaseServerClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!resolvedAccountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 },
      );
    }

    const allowed = await assertAccountMembership(resolvedAccountId, user.id);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const admin = getSupabaseServerAdminClient();
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = file.name.includes('.')
    ? file.name.split('.').pop()
    : file.type === 'application/pdf'
      ? 'pdf'
      : 'jpg';
  const fileName = `${crypto.randomUUID()}-${safeSegment(file.name) || 'file'}.${ext}`;
  const path = `${resolvedAccountId}/${fileName}`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message || 'Upload failed' },
      { status: 500 },
    );
  }

  const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  return NextResponse.json({
    attachment: {
      name: file.name,
      url,
      mimeType: file.type,
      size: file.size,
    },
  });
}
