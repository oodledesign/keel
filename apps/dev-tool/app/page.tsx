import { ServiceCard } from '@/components/status-tile';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Page, PageBody, PageHeader } from '@kit/ui/page';

import { loadDashboardKitPrerequisites } from './lib/prerequisites-dashboard.loader';
import { loadDashboardKitStatus } from './lib/status-dashboard.loader';

export default async function DashboardPage() {
  const [status, prerequisites] = await Promise.all([
    loadDashboardKitStatus(),
    loadDashboardKitPrerequisites(),
  ]);

  const failedRequiredCount = prerequisites.prerequisites.filter(
    (item) => item.required && item.status === 'fail',
  ).length;

  const warnCount = prerequisites.prerequisites.filter(
    (item) => item.status === 'warn',
  ).length;

  const failedRequired = prerequisites.prerequisites.filter(
    (item) => item.required && item.status === 'fail',
  );

  const prerequisiteRemedies = Array.from(
    new Set(
      failedRequired.flatMap((item) => [
        ...(item.remedies ?? []),
        ...(item.install_command ? [item.install_command] : []),
        ...(item.install_url ? [item.install_url] : []),
      ]),
    ),
  );

  return (
    <Page style={'custom'}>
      <PageHeader
        displaySidebarTrigger={false}
        title={'Dev Tool'}
        description={'Kit MCP status for this workspace'}
      />

      <PageBody className={'space-y-8 py-2'}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <ServiceCard
            name={'Variant'}
            status={{
              status: 'success',
              message: `${status.variant} (${status.variant_family})`,
            }}
          />

          <ServiceCard
            name={'Runtime'}
            status={{
              status: 'success',
              message: `${status.framework} • Node ${status.node_version} • ${status.package_manager}`,
            }}
          />

          <ServiceCard
            name={'Dependencies'}
            status={{
              status: status.deps_installed ? 'success' : 'error',
              message: status.deps_installed
                ? 'Dependencies installed'
                : 'node_modules not found',
            }}
          />

          <ServiceCard
            name={'Git'}
            status={{
              status:
                status.git_branch === 'unknown'
                  ? 'info'
                  : status.git_clean
                    ? 'success'
                    : 'warning',
              message: `${status.git_branch} (${status.git_clean ? 'clean' : 'dirty'}) • ${status.git_modified_files.length} modified • ${status.git_untracked_files.length} untracked`,
            }}
          />

          <ServiceCard
            name={'Dev Server'}
            status={{
              status: status.services.app.running ? 'success' : 'error',
              message: status.services.app.running
                ? `Running on port ${status.services.app.port}`
                : 'Not running',
            }}
          />

          <ServiceCard
            name={'Supabase'}
            status={{
              status: status.services.supabase.running ? 'success' : 'error',
              message: status.services.supabase.running
                ? `Running${status.services.supabase.api_port ? ` (API ${status.services.supabase.api_port})` : ''}${status.services.supabase.studio_port ? ` (Studio ${status.services.supabase.studio_port})` : ''}`
                : 'Not running',
            }}
          />

          <ServiceCard
            name={'Merge Check'}
            status={{
              status:
                status.git_merge_check.has_conflicts === true
                  ? 'warning'
                  : status.git_merge_check.detectable
                    ? 'success'
                    : 'info',
              message: status.git_merge_check.detectable
                ? status.git_merge_check.has_conflicts
                  ? `${status.git_merge_check.conflict_files.length} potential conflicts vs ${status.git_merge_check.target_branch}`
                  : `No conflicts vs ${status.git_merge_check.target_branch}`
                : status.git_merge_check.message,
            }}
          />

          <ServiceCard
            name={'Prerequisites'}
            status={{
              status:
                prerequisites.overall === 'fail'
                  ? 'error'
                  : prerequisites.overall === 'warn'
                    ? 'warning'
                    : 'success',
              message:
                prerequisites.overall === 'fail'
                  ? `${failedRequiredCount} required tools missing/mismatched`
                  : prerequisites.overall === 'warn'
                    ? `${warnCount} optional warnings`
                    : 'All prerequisites satisfied',
            }}
          />
        </div>

        {failedRequired.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Prerequisites Details</CardTitle>
            </CardHeader>

            <CardContent className={'space-y-4'}>
              <div className={'space-y-2'}>
                <p className={'text-sm font-medium'}>Missing or Mismatched</p>
                <ul
                  className={
                    'text-muted-foreground list-disc space-y-1 pl-5 text-sm'
                  }
                >
                  {failedRequired.map((item) => (
                    <li key={item.id}>
                      {item.name}
                      {item.version
                        ? ` (installed ${item.version}, requires >= ${item.minimum_version})`
                        : ' (not installed)'}
                    </li>
                  ))}
                </ul>
              </div>

              <div className={'space-y-2'}>
                <p className={'text-sm font-medium'}>Remediation</p>
                <ul
                  className={
                    'text-muted-foreground list-disc space-y-1 pl-5 text-sm'
                  }
                >
                  {prerequisiteRemedies.map((remedy) => (
                    <li key={remedy}>
                      <code>{remedy}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </PageBody>
    </Page>
  );
}
