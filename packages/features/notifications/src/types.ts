import { Tables } from '@kit/supabase/database';

export type Notification = Pick<
  Tables<'notifications'>,
  | 'id'
  | 'account_id'
  | 'body'
  | 'dismissed'
  | 'muted'
  | 'type'
  | 'created_at'
  | 'link'
>;
