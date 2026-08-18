'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { fetchLinkMetadata } from '~/lib/workspace-links/fetch-link-metadata';
import {
  displayLinkHostname,
  normalizeLinkUrl,
} from '~/lib/workspace-links/link-metadata';

import { workAccountPath } from '../work-account-path';
import { mapLinkRow, workspaceLinksTable } from './links-loader';

const LinkContextSchema = z
  .object({
    type: z.enum(['project', 'job', 'client', 'property', 'task']),
    id: z.string().uuid(),
  })
  .nullable()
  .optional();

function linkToColumns(link: z.infer<typeof LinkContextSchema>) {
  const cols = {
    project_id: null as string | null,
    client_id: null as string | null,
    client_org_id: null as string | null,
    property_id: null as string | null,
    task_id: null as string | null,
  };
  if (!link) return cols;
  switch (link.type) {
    case 'project':
    case 'job':
      cols.project_id = link.id;
      break;
    case 'client':
      cols.client_id = link.id;
      break;
    case 'property':
      cols.property_id = link.id;
      break;
    case 'task':
      cols.task_id = link.id;
      break;
  }
  return cols;
}

function publicHttpUrlOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  return normalizeLinkUrl(value);
}

function revalidateLinkPaths(accountSlug: string, personalScope?: boolean) {
  if (personalScope) {
    revalidatePath(pathsConfig.app.personalNotes);
    revalidatePath(pathsConfig.app.home);
    return;
  }

  revalidatePath(
    pathsConfig.app.accountNotes.replace('[account]', accountSlug),
  );
  revalidatePath(pathsConfig.app.accountDocs.replace('[account]', accountSlug));
  revalidatePath(workAccountPath(pathsConfig.app.accountHome, accountSlug));
}

export const fetchWorkspaceLinkMetadataAction = enhanceAction(
  async (data) => {
    const url = normalizeLinkUrl(data.url);
    if (!url) {
      throw new Error('Enter a valid http or https URL');
    }

    try {
      const metadata = await fetchLinkMetadata(url);
      return {
        url,
        title: metadata.title || displayLinkHostname(url),
        description: metadata.description,
        faviconUrl: metadata.faviconUrl,
        ogImageUrl: metadata.ogImageUrl,
      };
    } catch {
      return {
        url,
        title: displayLinkHostname(url),
        description: '',
        faviconUrl: null,
        ogImageUrl: null,
      };
    }
  },
  {
    schema: z.object({
      url: z.string().min(1).max(2048),
    }),
  },
);

export const createWorkspaceLinkAction = enhanceAction(
  async (data, user) => {
    const url = normalizeLinkUrl(data.url);
    if (!url) {
      throw new Error('Enter a valid http or https URL');
    }

    const client = getSupabaseServerClient();
    const title = data.title.trim() || displayLinkHostname(url);
    const description = data.description.trim();

    const { data: inserted, error } = await workspaceLinksTable(client)
      .insert({
        account_id: data.accountId,
        title,
        url,
        description,
        favicon_url: publicHttpUrlOrNull(data.faviconUrl),
        og_image_url: publicHttpUrlOrNull(data.ogImageUrl),
        is_pinned: false,
        created_by: user.id,
        ...linkToColumns(data.link),
      })
      .select(
        `
        id, title, url, description, favicon_url, og_image_url, is_pinned,
        project_id, client_id, client_org_id, property_id, task_id,
        updated_at,
        projects(name),
        clients(display_name),
        properties(name),
        tasks(title)
      `,
      )
      .single();

    if (error) throw error;
    if (!inserted) throw new Error('Could not save link');

    revalidateLinkPaths(data.accountSlug, data.personalScope);
    return { link: mapLinkRow(inserted) };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      personalScope: z.boolean().optional(),
      title: z.string().max(500),
      url: z.string().min(1).max(2048),
      description: z.string().max(4000),
      faviconUrl: z.string().max(2048).nullable().optional(),
      ogImageUrl: z.string().max(2048).nullable().optional(),
      link: LinkContextSchema,
    }),
  },
);

export const deleteWorkspaceLinkAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { error } = await workspaceLinksTable(client)
      .delete()
      .eq('id', data.linkId)
      .eq('account_id', data.accountId);

    if (error) throw error;
    revalidateLinkPaths(data.accountSlug, data.personalScope);
    return { success: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      linkId: z.string().uuid(),
      personalScope: z.boolean().optional(),
    }),
  },
);
