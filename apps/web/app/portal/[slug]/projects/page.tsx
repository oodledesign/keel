import Link from 'next/link';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { ProfileAvatar } from '@kit/ui/profile-avatar';

import pathsConfig from '~/config/paths.config';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

import { formatPortalDate } from '../_components/portal-badges';
import { loadClientPortalContext } from '../_lib/server/client-portal.loader';
import { createClientPortalService } from '../_lib/server/client-portal.service';

interface PortalProjectsPageProps {
  params: Promise<{ slug: string }>;
}

export const generateMetadata = async () => ({ title: 'Projects' });

export default async function PortalProjectsPage({
  params,
}: PortalProjectsPageProps) {
  const { slug } = await params;
  const ctx = await loadClientPortalContext(slug);
  const service = createClientPortalService(getSupabaseServerClient());
  const projects = await service.listPortalProjects(ctx.clientOrgId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--ozer-text-on-light)]">
          Projects
        </h2>
        <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
          Projects your team has shared with you.
        </p>
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
          No projects have been shared yet.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={pathsConfig.app.clientPortalProjectDetail
                .replace('[clientSlug]', slug)
                .replace('[projectId]', project.id)}
            >
              <Card className="transition-colors hover:bg-[var(--workspace-shell-panel-hover)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProfileAvatar
                      displayName={project.name}
                      pictureUrl={toSupabasePublicStorageUrl(
                        project.pictureUrl,
                      )}
                      className="size-10 shrink-0"
                    />
                    <CardTitle className="truncate text-base font-medium">
                      {project.name}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  {project.status ? (
                    <p className="text-sm text-[var(--ozer-text-on-light)] capitalize">
                      {project.status.replace(/_/g, ' ')}
                    </p>
                  ) : null}
                  <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
                    Due {formatPortalDate(project.dueDate)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
