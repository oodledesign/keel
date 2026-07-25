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

  if (!portalMember?.length) return false;

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
    if (row.business_id === accountId) {
      return true;
    }
    if (row.business_id) {
      const { data: business } = await client
        .from('businesses')
        .select('account_id')
        .eq('id', row.business_id)
        .maybeSingle();
      if (
        (business as { account_id?: string | null } | null)?.account_id ===
        accountId
      ) {
        return true;
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
