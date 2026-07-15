export const SIGNATURE_CHANGE_REQUEST_FIELDS = [
  { key: 'full_name', label: 'Full name' },
  { key: 'job_title', label: 'Job title' },
  { key: 'department', label: 'Department' },
  { key: 'phone_direct', label: 'Direct phone' },
  { key: 'phone_mobile', label: 'Mobile phone' },
  { key: 'signature_email', label: 'Signature email' },
  { key: 'photo', label: 'Photo' },
  { key: 'other', label: 'Something else' },
] as const;

export type SignatureChangeRequestFieldKey =
  (typeof SIGNATURE_CHANGE_REQUEST_FIELDS)[number]['key'];

export type SignatureChangeRequestStatus = 'open' | 'resolved' | 'dismissed';

export type SignatureChangeRequest = {
  id: string;
  account_id: string;
  staff_id: string;
  preview_share_id: string | null;
  requester_name: string | null;
  requester_email: string | null;
  message: string;
  field_keys: string[];
  status: SignatureChangeRequestStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  staff_name?: string | null;
  staff_email?: string | null;
};

export function labelForChangeRequestField(key: string) {
  return (
    SIGNATURE_CHANGE_REQUEST_FIELDS.find((field) => field.key === key)?.label ??
    key
  );
}
