import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  escapeNotificationHtml,
  wrapNotificationEmail,
} from '~/lib/email/wrap-notification-email';
import { resolveTransactionalEmailFrom } from '~/lib/email/zeptomail-client';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

/**
 * Notify super-admins whenever a new lead signs up to the waiting list.
 * Fails silently so it never blocks the public subscriber experience.
 */
export async function notifyAdminWaitlistSignup(input: {
  email: string;
  source: string;
  interests: string[];
}): Promise<void> {
  try {
    const admin = getSupabaseServerAdminClient();

    // Check super-admins
    const { data: users, error } = await admin.auth.admin.listUsers({
      perPage: 50,
    });

    if (error || !users?.users) {
      console.error(
        '[waitlist-notify] Could not list users for super-admin alert:',
        error,
      );
      return;
    }

    const superAdminEmails = users.users
      .filter((u) => u.app_metadata?.role === 'super-admin' && u.email)
      .map((u) => u.email as string);

    if (superAdminEmails.length === 0) {
      console.warn('[waitlist-notify] No super-admins found to notify.');
      return;
    }

    const sender =
      resolveTransactionalEmailFrom('Ozer Alerts') ||
      'Ozer Alerts <noreply@ozer.so>';

    const safeEmail = escapeNotificationHtml(input.email);
    const safeSource = escapeNotificationHtml(input.source);
    const safeInterests = escapeNotificationHtml(
      input.interests.join(', ') || 'none',
    );

    const bodyHtml = `
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5; color: #2A1720;">
        A new agency or user has joined the Ozer waiting list:
      </p>
      <div style="background-color: #FBF6EC; border: 1px solid #E7DECF; border-radius: 8px; padding: 16px; margin: 0 0 20px;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #2A1720;">
          <strong>Work email:</strong> <a href="mailto:${safeEmail}" style="color: #FF5C34; text-decoration: underline;">${safeEmail}</a>
        </p>
        <p style="margin: 0 0 8px; font-size: 14px; color: #5A4450;">
          <strong>Source:</strong> ${safeSource}
        </p>
        <p style="margin: 0; font-size: 14px; color: #5A4450;">
          <strong>Interests:</strong> ${safeInterests}
        </p>
      </div>
      <p style="margin: 0; font-size: 13px; color: #5A4450;">
        You can view all leads and reply from the Super Admin dashboard.
      </p>
    `;

    const html = wrapNotificationEmail(bodyHtml, {
      title: 'New Waiting List Signup',
      heading: 'New Waiting List Signup',
      preview: `${input.email} joined the waiting list`,
      cta: {
        label: 'View waiting list',
        href: 'https://app.ozer.so/admin/waiting-list',
      },
    });

    for (const adminEmail of superAdminEmails) {
      await sendPlatformEmail({
        type: 'waitlist_notification',
        mail: {
          to: adminEmail,
          from: sender,
          subject: `New waiting list lead: ${input.email}`,
          html,
        },
      });
    }
  } catch (err) {
    console.error('[waitlist-notify] Unexpected error sending alert:', err);
  }
}
