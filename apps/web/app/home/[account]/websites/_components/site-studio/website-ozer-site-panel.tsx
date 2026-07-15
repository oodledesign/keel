'use client';

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import { type Data, Puck } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { ExternalLink, Loader2, X } from 'lucide-react';

import {
  SiteMediaUploadProvider,
  resolveTokensStyle,
} from '@kit/site-blocks-core';
import { resolveSiteBlocksConfig } from '@kit/site-blocks-workspaces';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import type {
  OzerSiteBundle,
  OzerSiteEditorRole,
  OzerSitePageRecord,
  OzerSiteSettings,
  PublishOzerSitesConflict,
} from '~/lib/websites/ozer-sites-types';
import {
  ozerSitePreviewUrl,
  resolveOzerSitePuckPermissions,
} from '~/lib/websites/ozer-sites-types';

import {
  getOzerSiteBundle,
  publishOzerSitePage,
  publishWebsiteToOzerSites,
  saveOzerSitePageDraft,
  updateOzerSiteSettings,
} from '../../_lib/server/ozer-sites-actions';
import { WebsiteBlockLibraryCard } from './website-block-library-card';

type Props = {
  accountId: string;
  websiteId: string;
  accountSlug: string;
  canEdit: boolean;
  role?: OzerSiteEditorRole;
  clientOrgId?: string;
};

async function uploadSiteMedia(accountId: string, file: File): Promise<string> {
  const body = new FormData();
  body.set('accountId', accountId);
  body.set('file', file);
  const res = await fetch('/api/websites/site-media', {
    method: 'POST',
    body,
  });
  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) {
    throw new Error(json.error || 'Upload failed');
  }
  return json.url;
}

function OzerSitePuckEditor({
  accountId,
  accountSlug,
  page,
  role,
  clientOrgId,
  settings,
  themeTokens,
  onClose,
  onSaved,
}: {
  accountId: string;
  accountSlug: string;
  page: OzerSitePageRecord;
  role: OzerSiteEditorRole;
  clientOrgId?: string;
  settings: OzerSiteSettings;
  themeTokens: Record<string, unknown>;
  onClose: () => void;
  onSaved: (page: OzerSitePageRecord) => void;
}) {
  const permissions = resolveOzerSitePuckPermissions(role, settings);
  const [data, setData] = useState<Data>(page.puckData);
  const [isSaving, startSaving] = useTransition();
  const [isPublishing, startPublishing] = useTransition();
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestData = useRef(data);

  useEffect(() => {
    latestData.current = data;
  }, [data]);

  const config = useMemo(
    () => resolveSiteBlocksConfig(accountSlug),
    [accountSlug],
  );
  const tokenStyle = useMemo(
    () => resolveTokensStyle(themeTokens as never),
    [themeTokens],
  );

  const persistDraft = useCallback(
    (next: Data) => {
      startSaving(async () => {
        try {
          const saved = await saveOzerSitePageDraft({
            accountId,
            pageId: page.id,
            puckData: next as unknown as Record<string, unknown>,
            asHumanEdit: true,
            clientOrgId,
          });
          if (saved) onSaved(saved);
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : 'Could not save draft',
          );
        }
      });
    },
    [accountId, clientOrgId, onSaved, page.id],
  );

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  function scheduleAutosave(next: Data) {
    setData(next);
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      persistDraft(next);
    }, 1200);
  }

  function saveNow() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    persistDraft(latestData.current);
  }

  function publish() {
    startPublishing(async () => {
      try {
        if (autosaveTimer.current) {
          clearTimeout(autosaveTimer.current);
        }
        await saveOzerSitePageDraft({
          accountId,
          pageId: page.id,
          puckData: latestData.current as unknown as Record<string, unknown>,
          asHumanEdit: true,
          clientOrgId,
        });
        const saved = await publishOzerSitePage({
          accountId,
          pageId: page.id,
          clientOrgId,
        });
        if (saved) {
          onSaved(saved);
          toast.success('Page published');
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not publish',
        );
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--workspace-shell-panel,#fff)]">
      <div className="flex items-center justify-between gap-2 border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent,#f7f7f5)] px-4 py-2">
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            <X className="mr-1 size-4" />
            Close
          </Button>
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Editing /{page.slug}
            {isSaving ? (
              <span className="ml-2 text-xs text-[var(--workspace-shell-text-muted)]">
                Saving draft…
              </span>
            ) : (
              <span className="ml-2 text-xs text-[var(--workspace-shell-text-muted)]">
                Autosave on
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isSaving}
            onClick={saveNow}
          >
            Save draft
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isPublishing}
            onClick={publish}
          >
            {isPublishing ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : null}
            Publish
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1" style={tokenStyle as CSSProperties}>
        <SiteMediaUploadProvider
          upload={(file) => uploadSiteMedia(accountId, file)}
        >
          <Puck
            config={config}
            data={data}
            permissions={permissions}
            onChange={scheduleAutosave}
          />
        </SiteMediaUploadProvider>
      </div>
    </div>
  );
}

export function WebsiteOzerSitePanel({
  accountId,
  websiteId,
  accountSlug,
  canEdit,
  role = 'agency',
  clientOrgId,
}: Props) {
  const [bundle, setBundle] = useState<OzerSiteBundle | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<PublishOzerSitesConflict[]>([]);
  const [resolutions, setResolutions] = useState<
    Record<string, 'overwrite' | 'skip'>
  >({});
  const [isLoading, startLoading] = useTransition();
  const [isPublishing, startPublishing] = useTransition();

  const reload = useCallback(() => {
    startLoading(async () => {
      try {
        const next = await getOzerSiteBundle({
          accountId,
          websiteId,
          clientOrgId,
        });
        setBundle(next);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not load site',
        );
      }
    });
  }, [accountId, clientOrgId, websiteId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const activePage =
    bundle?.pages.find((page) => page.id === activePageId) ?? null;

  function publishFromStudio(extra?: Record<string, 'overwrite' | 'skip'>) {
    const nextResolutions = { ...resolutions, ...extra };
    if (extra) setResolutions(nextResolutions);

    startPublishing(async () => {
      try {
        const result = await publishWebsiteToOzerSites({
          accountId,
          websiteId,
          resolveConflicts:
            Object.keys(nextResolutions).length > 0
              ? nextResolutions
              : undefined,
        });
        if (!result.ok) {
          setConflicts(result.conflicts);
          toast.message('Resolve publish conflicts before continuing');
          return;
        }
        setConflicts([]);
        setResolutions({});
        toast.success(`Published — ${result.previewUrl}`);
        reload();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Publish failed');
      }
    });
  }

  if (isLoading && !bundle) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Loading Ozer Site…
      </p>
    );
  }

  if (!bundle?.site) {
    return (
      <div className="space-y-4 rounded-lg border border-[color:var(--workspace-shell-border)] p-4">
        <div>
          <h3 className="text-base font-semibold text-[var(--workspace-shell-text)]">
            Publish to Ozer Sites
          </h3>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Create a live Puck-hosted site from this Site Studio project. No
            code export — pages render on{' '}
            <code className="text-xs">*.sites.ozer.so</code>.
          </p>
        </div>
        {canEdit && role === 'agency' ? (
          <Button
            type="button"
            disabled={isPublishing}
            onClick={() => publishFromStudio()}
          >
            {isPublishing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Publish to Ozer Sites
          </Button>
        ) : (
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            No live site yet. Ask the agency team to publish.
          </p>
        )}
      </div>
    );
  }

  const { site, pages } = bundle;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
        <div>
          <h3 className="text-base font-semibold text-[var(--workspace-shell-text)]">
            {site.name}
          </h3>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Status: {site.status} · /{site.subdomain}
          </p>
          <a
            href={ozerSitePreviewUrl(site.subdomain)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm text-[var(--ozer-accent)] underline-offset-2 hover:underline"
          >
            Open live site <ExternalLink className="size-3.5" />
          </a>
        </div>
        {canEdit && role === 'agency' ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPublishing}
              onClick={() => publishFromStudio()}
            >
              Re-publish from Studio
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void updateOzerSiteSettings({
                  accountId,
                  siteId: site.id,
                  settings: {
                    portalEditEnabled: !site.settings.portalEditEnabled,
                  },
                }).then(() => {
                  toast.success(
                    site.settings.portalEditEnabled
                      ? 'Portal editing disabled'
                      : 'Portal editing enabled',
                  );
                  reload();
                })
              }
            >
              Portal edit: {site.settings.portalEditEnabled ? 'on' : 'off'}
            </Button>
          </div>
        ) : null}
      </div>

      {conflicts.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-medium">
            These pages were edited in Ozer since the last Studio publish.
            Choose overwrite or skip for each.
          </p>
          <ul className="space-y-2">
            {conflicts.map((conflict) => (
              <li
                key={conflict.pageId}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>
                  /{conflict.slug} — {conflict.title}
                  {resolutions[conflict.pageId] ? (
                    <span className="ml-2 text-xs opacity-70">
                      ({resolutions[conflict.pageId]})
                    </span>
                  ) : null}
                </span>
                <span className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      publishFromStudio({ [conflict.pageId]: 'skip' })
                    }
                  >
                    Skip
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      publishFromStudio({ [conflict.pageId]: 'overwrite' })
                    }
                  >
                    Overwrite
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          Pages
        </p>
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => setActivePageId(page.id)}
            disabled={!canEdit}
            className={cn(
              'flex w-full flex-col rounded-lg border px-2.5 py-2 text-left text-sm',
              'border-[color:var(--workspace-shell-border)] hover:border-[var(--ozer-accent)]',
            )}
          >
            <span className="font-medium">{page.title || page.slug}</span>
            <span className="text-xs text-[var(--workspace-shell-text-muted)]">
              /{page.slug} · {page.status}
            </span>
          </button>
        ))}
      </div>

      {role === 'agency' ? (
        <WebsiteBlockLibraryCard accountSlug={accountSlug} />
      ) : null}

      {activePage && canEdit && bundle.site ? (
        <OzerSitePuckEditor
          key={activePage.id}
          accountId={accountId}
          accountSlug={accountSlug}
          page={activePage}
          role={role}
          clientOrgId={clientOrgId}
          settings={site.settings}
          themeTokens={site.themeTokens as Record<string, unknown>}
          onClose={() => setActivePageId(null)}
          onSaved={(saved) => {
            setBundle((current) =>
              current
                ? {
                    ...current,
                    pages: current.pages.map((page) =>
                      page.id === saved.id ? saved : page,
                    ),
                  }
                : current,
            );
          }}
        />
      ) : null}
    </div>
  );
}
