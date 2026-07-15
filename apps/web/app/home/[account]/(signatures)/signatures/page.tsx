import { AlertCircle, CheckCircle2, Clock, Users } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import { ModuleDataSection } from '../../_components/module-data-section';
import { SignaturesStaffTable } from '../_components/signatures-staff-table';

import {
  loadSignaturesDashboard,
  loadSignaturesWorkspace,
} from '../_lib/server/signatures-data';

type SignaturesDashboardPageProps = {
  params: Promise<{ account: string }>;
};

const cards = [
  { key: 'total', label: 'Total Staff', icon: Users, tone: 'text-[#39AEB3]' },
  { key: 'pushed', label: 'Pushed', icon: CheckCircle2, tone: 'text-[var(--ozer-accent)]' },
  { key: 'pending', label: 'Pending', icon: Clock, tone: 'text-[#F2C94C]' },
  { key: 'errors', label: 'Errors', icon: AlertCircle, tone: 'text-[#E85D75]' },
] as const;

export default async function SignaturesDashboardPage({
  params,
}: SignaturesDashboardPageProps) {
  const { account } = await params;
  const workspace = await loadSignaturesWorkspace(account);
  const accountId = workspace.account.id as string;
  const { summary, staff } = await loadSignaturesDashboard(accountId);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.key}
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${card.tone}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{summary[card.key]}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ModuleDataSection
        title="Staff signatures"
        description="A quick view of synced staff, assigned templates, and the last push state."
      >
        <SignaturesStaffTable
          accountId={accountId}
          accountSlug={account}
          staff={staff}
          compact
        />
      </ModuleDataSection>
    </div>
  );
}
