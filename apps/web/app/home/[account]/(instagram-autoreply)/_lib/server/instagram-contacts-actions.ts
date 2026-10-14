'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';

import pathsConfig from '~/config/paths.config';
import {
  assertIgManagePermission,
  assertInstagramAutoreplyAccess,
} from '~/lib/instagram-autoreply/assert-access';

import { igContactActionSchema } from '../schema/instagram-autoreply.schema';

/** Subject-access export: everything Ozer holds about one Instagram contact. */
export const exportIgContact = enhanceAction(
  async (input, user) => {
    const { client } = await assertInstagramAutoreplyAccess(
      input.accountId,
      user.id,
    );
    await assertIgManagePermission(client, input.accountId, user.id);

    const { data: contact, error } = await client
      .from('ig_contacts')
      .select(
        'id, igsid, username, display_name, tags, custom_fields, consent, is_follower, last_inbound_at, opted_out_at, handoff_at, linked_client_id, created_at, updated_at',
      )
      .eq('id', input.contactId)
      .eq('account_id', input.accountId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!contact) throw new Error('Contact not found');

    const [runs, events, comments] = await Promise.all([
      client
        .from('ig_automation_runs')
        .select(
          'id, trigger_id, source, status, current_position, created_at, completed_at',
        )
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: true }),
      client
        .from('ig_message_events')
        .select(
          'direction, event_type, step_position, step_type, send_status, body, payload, created_at',
        )
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: true }),
      client
        .from('ig_comment_events')
        .select(
          'comment_id, media_id, comment_text, public_reply_content, dm_content, created_at',
        )
        .eq('account_id', input.accountId)
        .eq('commenter_ig_id', contact.igsid)
        .order('created_at', { ascending: true }),
    ]);

    for (const result of [runs, events, comments]) {
      if (result.error) throw new Error(result.error.message);
    }

    return {
      exported_at: new Date().toISOString(),
      contact,
      automation_runs: runs.data ?? [],
      messages: events.data ?? [],
      comments: comments.data ?? [],
    };
  },
  { schema: igContactActionSchema },
);

/**
 * Erase a contact (UK GDPR): deletes their messages, runs and profile and
 * scrubs their comment log, keeping only anonymous funnel counts. A linked
 * CRM client record is left untouched.
 */
export const eraseIgContact = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertInstagramAutoreplyAccess(
      input.accountId,
      user.id,
    );

    const { data: contact } = await client
      .from('ig_contacts')
      .select('id')
      .eq('id', input.contactId)
      .eq('account_id', input.accountId)
      .maybeSingle();
    if (!contact) throw new Error('Contact not found');

    const { error } = await client.rpc('erase_ig_contact', {
      p_contact_id: input.contactId,
    });
    if (error) throw new Error(error.message);

    revalidatePath(
      pathsConfig.app.accountInstagramAutoreplyContacts.replace(
        '[account]',
        slug,
      ),
    );
    return { ok: true };
  },
  { schema: igContactActionSchema },
);
