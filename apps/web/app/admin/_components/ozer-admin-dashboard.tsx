import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';

import { loadAdminDashboardStats } from '~/admin/_lib/load-admin-dashboard';

const links = [
  { href: '/admin/users', label: 'Users', description: 'All auth users' },
  { href: '/admin/workspaces', label: 'Workspaces', description: 'Team accounts & billing' },
  { href: '/admin/billing', label: 'Billing', description: 'MRR, dunning & churn' },
  { href: '/admin/accounts', label: 'Accounts', description: 'Personal & team accounts' },
  { href: '/admin/branding', label: 'Branding', description: 'Colours, fonts & logos' },
  { href: '/admin/support', label: 'Support', description: 'Platform tickets' },
  { href: '/admin/email-marketing', label: 'Email marketing', description: 'Campaigns, contacts & lists' },
  { href: '/admin/email-log', label: 'Email log', description: 'Grouped & individual sends' },
  { href: '/admin/audit', label: 'Audit log', description: 'Admin actions' },
];

export async function OzerAdminDashboard() {
  const data = await loadAdminDashboardStats();

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Users" value={data.accounts} />
        <StatCard title="Team workspaces" value={data.teamAccounts} />
        <StatCard title="Paying customers" value={data.subscriptions} />
        <StatCard title="Active trials" value={data.trials} />
        <StatCard title="Past due" value={data.pastDue} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition hover:border-foreground/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{item.label}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        Dashboard counts are approximate snapshots from the database.
      </p>
    </div>
  );
}

function StatCard(props: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{props.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{props.value}</p>
      </CardContent>
    </Card>
  );
}
