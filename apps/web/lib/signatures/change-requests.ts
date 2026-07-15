import 'server-only';

import {
  SIGNATURE_CHANGE_REQUEST_FIELDS,
  type SignatureChangeRequest,
  type SignatureChangeRequestFieldKey,
  type SignatureChangeRequestStatus,
} from './change-request-fields';
import { getSignaturesSupabaseClient } from './graph';
import { resolveActiveSignaturePreviewShare } from './preview-share';

export {
  SIGNATURE_CHANGE_REQUEST_FIELDS,
  labelForChangeRequestField,
  type SignatureChangeRequest,
  type SignatureChangeRequestFieldKey,
  type SignatureChangeRequestStatus,
} from './change-request-fields';

const ALLOWED_FIELD_KEYS = new Set(
  SIGNATURE_CHANGE_REQUEST_FIELDS.map((field) => field.key),
);

export async function submitSignatureChangeRequest(input: {
  token: string;
  message: string;
  fieldKeys: string[];
  requesterName?: string | null;
}) {
  const share = await resolveActiveSignaturePreviewShare(input.token);
  if (!share?.staff_id) {
    throw new Error('This install link cannot submit change requests');
  }

  const message = input.message.trim();
  if (message.length < 3) {
    throw new Error('Please describe the change you need');
  }

  const fieldKeys = [
    ...new Set(
      input.fieldKeys
        .map((key) => key.trim())
        .filter((key) =>
          ALLOWED_FIELD_KEYS.has(key as SignatureChangeRequestFieldKey),
        ),
    ),
  ];

  if (!fieldKeys.length) {
    throw new Error('Select at least one field to update');
  }

  const db = getSignaturesSupabaseClient();
  const { data: staff, error: staffError } = await db
    .from('staff')
    .select('id, email, full_name')
    .eq('id', share.staff_id)
    .eq('account_id', share.account_id)
    .maybeSingle();

  if (staffError || !staff) {
    throw new Error('Staff profile not found for this link');
  }

  const { data, error } = await db
    .from('change_requests')
    .insert({
      account_id: share.account_id,
      staff_id: share.staff_id,
      preview_share_id: share.id,
      requester_name:
        input.requesterName?.trim() ||
        (staff.full_name as string | null) ||
        null,
      requester_email: (staff.email as string | null) ?? null,
      message,
      field_keys: fieldKeys,
      status: 'open',
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not submit change request');
  }

  return { id: data.id as string };
}

export async function listSignatureChangeRequests(accountId: string) {
  const db = getSignaturesSupabaseClient();
  const { data, error } = await db
    .from('change_requests')
    .select(
      'id, account_id, staff_id, preview_share_id, requester_name, requester_email, message, field_keys, status, resolved_at, resolved_by, created_at, updated_at',
    )
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as SignatureChangeRequest[];
  if (!rows.length) return rows;

  const staffIds = [...new Set(rows.map((row) => row.staff_id))];
  const { data: staffRows } = await db
    .from('staff')
    .select('id, full_name, email')
    .eq('account_id', accountId)
    .in('id', staffIds);

  type StaffLookup = {
    id: string;
    full_name: string | null;
    email: string | null;
  };
  const staffList = (staffRows ?? []) as StaffLookup[];
  const staffById = new Map(
    staffList.map((row) => [
      row.id,
      {
        name: row.full_name,
        email: row.email,
      },
    ]),
  );

  return rows.map((row) => {
    const staff = staffById.get(row.staff_id);
    return {
      ...row,
      field_keys: Array.isArray(row.field_keys) ? row.field_keys : [],
      staff_name: staff?.name ?? null,
      staff_email: staff?.email ?? null,
    };
  });
}

export async function listOpenChangeRequestsForStaff(
  accountId: string,
  staffId: string,
) {
  const db = getSignaturesSupabaseClient();
  const { data, error } = await db
    .from('change_requests')
    .select(
      'id, account_id, staff_id, preview_share_id, requester_name, requester_email, message, field_keys, status, resolved_at, resolved_by, created_at, updated_at',
    )
    .eq('account_id', accountId)
    .eq('staff_id', staffId)
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as SignatureChangeRequest[]).map((row) => ({
    ...row,
    field_keys: Array.isArray(row.field_keys) ? row.field_keys : [],
  }));
}

export async function countOpenChangeRequestsByStaff(accountId: string) {
  const db = getSignaturesSupabaseClient();
  const { data, error } = await db
    .from('change_requests')
    .select('staff_id')
    .eq('account_id', accountId)
    .eq('status', 'open');

  if (error) {
    throw new Error(error.message);
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const staffId = String(row.staff_id);
    counts.set(staffId, (counts.get(staffId) ?? 0) + 1);
  }
  return counts;
}

export async function updateSignatureChangeRequestStatus(input: {
  accountId: string;
  requestId: string;
  status: Exclude<SignatureChangeRequestStatus, 'open'>;
  resolvedBy?: string | null;
}) {
  const db = getSignaturesSupabaseClient();
  const { error } = await db
    .from('change_requests')
    .update({
      status: input.status,
      resolved_at: new Date().toISOString(),
      resolved_by: input.resolvedBy ?? null,
    })
    .eq('id', input.requestId)
    .eq('account_id', input.accountId);

  if (error) {
    throw new Error(error.message);
  }
}
