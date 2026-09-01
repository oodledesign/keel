'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';

const GetPlatformEmailPreviewSchema = z.object({
  emailLogId: z.string().uuid(),
});

export const getPlatformEmailPreviewAction = enhanceAction(
  async (input) => {
    await requireSuperAdmin();
    const client = getSupabaseServerClient();

    const { data, error } = await (
      client as unknown as {
        from: (table: string) => ReturnType<typeof client.from>;
      }
    )
      .from('platform_email_log')
      .select(
        'id, email_type, subject, recipient_email, sender_email, status, html_body, created_at',
      )
      .eq('id', input.emailLogId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error('Email log entry not found');
    }

    const row = data as {
      id: string;
      email_type: string;
      subject: string;
      recipient_email: string;
      sender_email: string | null;
      status: string;
      html_body: string | null;
      created_at: string;
    };

    return {
      id: row.id,
      emailType: row.email_type,
      subject: row.subject,
      recipientEmail: row.recipient_email,
      senderEmail: row.sender_email,
      status: row.status,
      htmlBody: row.html_body,
      createdAt: row.created_at,
    };
  },
  { schema: GetPlatformEmailPreviewSchema },
);
