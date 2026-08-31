import { NativeHttpError } from './http';

export type NativeTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'client_review'
  | 'completed';

export function mapNativeTaskStatus(
  status: string | null | undefined,
): NativeTaskStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'in_progress':
      return 'in_progress';
    case 'client_review':
    case 'review':
    case 'in_review':
    case 'awaiting_client':
      return 'client_review';
    case 'done':
    case 'completed':
    case 'complete':
    case 'cancelled':
      return 'completed';
    default:
      return 'pending';
  }
}

export function uiStatusToDb(
  status: string,
): 'todo' | 'in_progress' | 'client_review' | 'done' | 'cancelled' {
  switch (status) {
    case 'pending':
    case 'todo':
    case 'not_started':
      return 'todo';
    case 'in_progress':
      return 'in_progress';
    case 'client_review':
      return 'client_review';
    case 'completed':
    case 'done':
      return 'done';
    case 'cancelled':
      return 'cancelled';
    default:
      throw new NativeHttpError(400, 'Invalid task status');
  }
}
