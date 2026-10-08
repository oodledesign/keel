import Link from 'next/link';

import { AdminGuard } from '@kit/admin/components/admin-guard';
import { PageBody, PageHeader } from '@kit/ui/page';
import { cn } from '@kit/ui/utils';

import { MessageReportsList } from './_components/message-reports-list';
import { loadAdminMessageReports } from './_lib/server/load-message-reports';

export const metadata = { title: 'Message reports' };

async function AdminMessageReportsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await props.searchParams;
  const filter = status === 'all' ? 'all' : 'open';
  const { reports, openCount } = await loadAdminMessageReports(filter);

  return (
    <>
      <PageHeader
        title="Message reports"
        description="Messages and conversations reported by users. Review each report within 24 hours."
      />
      <PageBody className="max-w-4xl py-4">
        <div className="mb-4 flex gap-2">
          {(
            [
              ['open', `Open (${openCount})`],
              ['all', 'All'],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              href={
                value === 'open'
                  ? '/admin/message-reports'
                  : '/admin/message-reports?status=all'
              }
              className={cn(
                'rounded-full border px-3 py-1 text-sm',
                filter === value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {label}
            </Link>
          ))}
        </div>
        <MessageReportsList key={filter} reports={reports} filter={filter} />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminMessageReportsPage);
