import { AlertCircle, CheckCircle2, Clock, Users } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import { ModuleDataSection } from '../../_components/module-data-section';
import { SignaturesActionsBar } from '../_components/signatures-actions-bar';
import { SignaturesStaffTable } from '../_components/signatures-staff-table';
import { isSignaturesUxPreviewEnabled } from '~/lib/signatures/ux-preview';

import {
  getSignaturesMailProvider,
  isSignaturesMailConnected,
  loadSignaturesDashboard,
  loadSignaturesWorkspace,
} from '../_lib/server/signatures-data';

type SignaturesDashboardPageProps = {
  params: Promise<{ account: string }>;
};

const cards = [
  { key: 'total', label: 'Total Staff', icon: Users, tone: 'text-[#39AEB3]' },
  { key: 'pushed', label: 'Pushed', icon: CheckCircle2, tone: 'text-[var(--keel-teal)]' },
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

  const uxPreview = isSignaturesUxPreviewEnabled();
  let mailActionsDisabled = false;
  let mailProvider: Awaited<ReturnType<typeof getSignaturesMailProvider>> = null;

  if (uxPreview) {
    try {
      mailActionsDisabled = !(await isSignaturesMailConnected(accountId));
    } catch {
      mailActionsDisabled = true;
    }
  } else {
    mailProvider = await getSignaturesMailProvider(accountId);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor staff signature status and push templates to Gmail or Outlook.
          </p>
        </div>
        <SignaturesActionsBar
          accountId={accountId}
          mailProvider={mailProvider}
          mailActionsDisabled={mailActionsDisabled}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.key}
              className="border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
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
        <SignaturesStaffTable accountSlug={account} staff={staff} compact />
      </ModuleDataSection>
    </div>
  );
}
