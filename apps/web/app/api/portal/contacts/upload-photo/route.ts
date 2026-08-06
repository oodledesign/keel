import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

export const runtime = 'nodejs';

const AVATARS_BUCKET = 'account_image';
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

function storagePathFromPictureUrl(url: string | null | undefined) {
  const trimmed = url?.trim();
  if (!trimmed || !trimmed.includes('/account_image/')) {
    return null;
  }
  return trimmed.split('/account_image/')[1]?.split('?')[0] ?? null;
}

function contactPhotoPath(accountId: string, contactId: string) {
  return `${accountId}/contact-${contactId}`;
}

/**
 * Resolves the calling portal contact's own CRM contact row and the
 * workspace account_id it belongs to. Never trusts client-supplied IDs for
 * authorization — everything is derived from the session user + their
 * client_members row for the given client_org.
 *
 * contacts.user_id is NOT a portal-login link — createContact() stamps it
 * with the *staff member* who created the record, so every contact a given
 * team member has ever added shares the same user_id. The real client link
 * is the client_contacts junction table. Match purely by email.
 */
async function resolvePortalContact(userId: string, clientOrgId: string) {
  const admin = getSupabaseServerAdminClient();

  const { data: membership } = await admin
    .from('client_members')
    .select('id')
    .eq('client_org_id', clientOrgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) return null;

  const { data: org } = await admin
    .from('client_orgs')
    .select('business_id')
    .eq('id', clientOrgId)
    .maybeSingle();

  const businessId = (org as { business_id?: string | null } | null)
    ?.business_id;
  if (!businessId) return null;

  const { data: business } = await admin
    .from('businesses')
    .select('account_id')
    .eq('id', businessId)
    .maybeSingle();

  const accountId =
    (business as { account_id?: string | null } | null)?.account_id ??
    businessId;
  if (!accountId) return null;

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const email = authUser?.user?.email?.trim().toLowerCase();
  if (!email) return null;

  const { data: orgClients } = await admin
    .from('clients')
    .select('id')
    .eq('client_org_id', clientOrgId);

  const orgClientIds = ((orgClients ?? []) as Array<{ id: string }>).map(
    (row) => row.id,
  );
  if (orgClientIds.length === 0) return null;

  const { data: links } = await admin
    .from('client_contacts')
    .select('contact_id')
    .in('client_id', orgClientIds);

  const contactIds = [
    ...new Set(
      ((links ?? []) as Array<{ contact_id: string }>).map(
        (row) => row.contact_id,
      ),
    ),
  ];
  if (contactIds.length === 0) return null;

  const { data: candidates } = await admin
    .from('contacts')
    .select('id, account_id, picture_url, email')
    .in('id', contactIds);

  const candidate = (
    (candidates ?? []) as Array<{
      id: string;
      account_id: string;
      picture_url: string | null;
      email: string | null;
    }>
  ).find((row) => row.email?.trim().toLowerCase() === email);

  if (!candidate) return null;

  return {
    contactId: candidate.id,
    accountId: candidate.account_id ?? accountId,
    pictureUrl: candidate.picture_url,
  };
}

export async function POST(request: Request) {
  try {
    const userClient = getSupabaseServerClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const clientOrgId = formData.get('clientOrgId');
    const remove = formData.get('remove') === '1';
    const file = formData.get('file');

    if (typeof clientOrgId !== 'string' || !clientOrgId.trim()) {
      return NextResponse.json(
        { error: 'clientOrgId is required' },
        { status: 400 },
      );
    }

    const contact = await resolvePortalContact(user.id, clientOrgId.trim());
    if (!contact) {
      return NextResponse.json(
        {
          error:
            'No contact record found for your account yet — ask your account manager to add one.',
        },
        { status: 404 },
      );
    }

    const admin = getSupabaseServerAdminClient();
    const bucket = admin.storage.from(AVATARS_BUCKET);
    const existingPath = storagePathFromPictureUrl(contact.pictureUrl);
    const nextPath = contactPhotoPath(contact.accountId, contact.contactId);

    if (remove) {
      if (existingPath) {
        await bucket.remove([existingPath]);
      }

      const { error: updateError } = await admin
        .from('contacts')
        .update({ picture_url: null, updated_at: new Date().toISOString() })
        .eq('id', contact.contactId);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      }

      return NextResponse.json({ pictureUrl: null });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image uploads are allowed.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Image is too large. Max size is 5MB.' },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    if (existingPath && existingPath !== nextPath) {
      await bucket.remove([existingPath]);
    }

    const { error: uploadError } = await bucket.upload(nextPath, bytes, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    });

    if (uploadError) {
      console.error('[portal-contacts] upload-photo:', uploadError.message);
      return NextResponse.json(
        { error: uploadError.message || 'Failed to upload photo.' },
        { status: 500 },
      );
    }

    const publicUrl = toSupabasePublicStorageUrl(
      bucket.getPublicUrl(nextPath).data.publicUrl,
    );

    if (!publicUrl) {
      return NextResponse.json(
        { error: 'Upload succeeded but public URL could not be generated.' },
        { status: 500 },
      );
    }

    const { nanoid } = await import('nanoid');
    const pictureUrl = `${publicUrl}?v=${nanoid(16)}`;

    const { error: updateError } = await admin
      .from('contacts')
      .update({ picture_url: pictureUrl, updated_at: new Date().toISOString() })
      .eq('id', contact.contactId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ pictureUrl });
  } catch (error) {
    console.error('[portal-contacts] upload-photo unhandled:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to upload contact photo.',
      },
      { status: 500 },
    );
  }
}
