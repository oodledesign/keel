import 'server-only';

import { cache } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  type FolderInTree,
  type FolderTreeRow,
  flattenFolderTree,
} from '../folder-tree';
import { resolveVideoThumbnailUrl } from '../thumbnail';
import type { VideoRow } from '../types';
import {
  type PublicVideoPageData,
  buildPublicVideoPageData,
} from './public-video.loader';
import { resolveBunnyCdnHostname } from './videos-data';

export type PublicFolderVideo = {
  id: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  created_at: string;
};

export type PublicFolderSection = {
  id: string;
  /** Path relative to the shared folder; null for the shared folder itself. */
  title: string | null;
  videos: PublicFolderVideo[];
};

export type PublicFolderPageData = {
  folder: { id: string; name: string };
  sections: PublicFolderSection[];
  totalVideos: number;
};

type SharedFolder = { id: string; account_id: string; name: string };

async function loadSharedFolder(
  admin: SupabaseClient,
  token: string,
): Promise<SharedFolder | null> {
  if (!token.trim()) return null;

  const { data, error } = await admin
    .from('video_folders')
    .select('id, account_id, name')
    .eq('public_share_token', token)
    .eq('public_share_enabled', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as SharedFolder | null) ?? null;
}

/** The shared folder plus every descendant, scoped to the folder's account. */
async function collectFolderTree(
  admin: SupabaseClient,
  folder: SharedFolder,
): Promise<FolderInTree[]> {
  const { data, error } = await admin
    .from('video_folders')
    .select('id, name, parent_folder_id')
    .eq('account_id', folder.account_id);

  if (error) throw new Error(error.message);

  return flattenFolderTree(folder.id, (data ?? []) as FolderTreeRow[]);
}

export const loadPublicFolderByToken = cache(
  async function loadPublicFolderByToken(
    token: string,
  ): Promise<PublicFolderPageData | null> {
    const admin = getSupabaseServerAdminClient();
    const folder = await loadSharedFolder(admin, token);
    if (!folder) return null;

    const tree = await collectFolderTree(admin, folder);

    const { data, error } = await admin
      .from('videos')
      .select(
        'id, title, folder_id, thumbnail_url, bunny_video_id, bunny_library_id, status, duration_seconds, created_at',
      )
      .eq('account_id', folder.account_id)
      .eq('status', 'ready')
      .in(
        'folder_id',
        tree.map((entry) => entry.id),
      )
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const cdnByLibrary = new Map<string, string>();
    const videosByFolder = new Map<string, PublicFolderVideo[]>();

    for (const row of (data ?? []) as Array<
      Pick<
        VideoRow,
        | 'id'
        | 'title'
        | 'folder_id'
        | 'thumbnail_url'
        | 'bunny_video_id'
        | 'bunny_library_id'
        | 'status'
        | 'duration_seconds'
        | 'created_at'
      >
    >) {
      if (!row.folder_id) continue;

      let cdnHostname = cdnByLibrary.get(row.bunny_library_id);
      if (cdnHostname === undefined) {
        cdnHostname = await resolveBunnyCdnHostname(row.bunny_library_id);
        cdnByLibrary.set(row.bunny_library_id, cdnHostname);
      }

      const list = videosByFolder.get(row.folder_id) ?? [];
      list.push({
        id: row.id,
        title: row.title,
        thumbnail_url: resolveVideoThumbnailUrl(row, cdnHostname),
        duration_seconds: row.duration_seconds,
        created_at: row.created_at,
      });
      videosByFolder.set(row.folder_id, list);
    }

    const sections = tree
      .map((entry) => ({
        id: entry.id,
        title: entry.path,
        videos: videosByFolder.get(entry.id) ?? [],
      }))
      .filter((section) => section.videos.length > 0);

    return {
      folder: { id: folder.id, name: folder.name },
      sections,
      totalVideos: sections.reduce(
        (count, section) => count + section.videos.length,
        0,
      ),
    };
  },
);

export type PublicFolderVideoPageData = {
  folder: { id: string; name: string };
  page: PublicVideoPageData;
};

/**
 * One video, reachable only because it sits inside a shared folder (or one of
 * its subfolders). The video does not need its own public link.
 */
export const loadPublicFolderVideo = cache(async function loadPublicFolderVideo(
  token: string,
  videoId: string,
): Promise<PublicFolderVideoPageData | null> {
  const admin = getSupabaseServerAdminClient();
  const folder = await loadSharedFolder(admin, token);
  if (!folder) return null;

  const tree = await collectFolderTree(admin, folder);

  const { data, error } = await admin
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .eq('account_id', folder.account_id)
    .eq('status', 'ready')
    .in(
      'folder_id',
      tree.map((entry) => entry.id),
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    folder: { id: folder.id, name: folder.name },
    page: await buildPublicVideoPageData(admin, data as VideoRow),
  };
});

/** Shared by the folder media route: same authorisation as the page. */
export async function findVideoInSharedFolder(
  token: string,
  videoId: string,
): Promise<{ id: string } | null> {
  const admin = getSupabaseServerAdminClient();
  const folder = await loadSharedFolder(admin, token);
  if (!folder) return null;

  const tree = await collectFolderTree(admin, folder);

  const { data, error } = await admin
    .from('videos')
    .select('id')
    .eq('id', videoId)
    .eq('account_id', folder.account_id)
    .eq('status', 'ready')
    .in(
      'folder_id',
      tree.map((entry) => entry.id),
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as { id: string } | null) ?? null;
}
