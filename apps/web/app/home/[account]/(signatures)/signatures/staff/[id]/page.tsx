import { notFound } from 'next/navigation';

import { listOpenChangeRequestsForStaff } from '~/lib/signatures/change-requests';

import { ModuleDataSection } from '../../../../_components/module-data-section';
import { SignatureStaffEditor } from '../../../_components/signature-staff-editor';
import {
  loadSignaturesWorkspace,
  loadStaffDetail,
} from '../../../_lib/server/signatures-data';

type SignatureStaffDetailPageProps = {
  params: Promise<{ account: string; id: string }>;
};

export default async function SignatureStaffDetailPage({
  params,
}: SignatureStaffDetailPageProps) {
  const { account, id } = await params;
  const workspace = await loadSignaturesWorkspace(account);
  const accountId = workspace.account.id as string;
  const [detail, openRequests] = await Promise.all([
    loadStaffDetail(accountId, id),
    listOpenChangeRequestsForStaff(accountId, id),
  ]);

  if (!detail) {
    notFound();
  }

  return (
    <ModuleDataSection
      title={detail.staff.full_name ?? detail.staff.email}
      description="Edit staff profile details, assign a template, and preview the rendered Outlook signature."
    >
      <SignatureStaffEditor
        accountId={accountId}
        accountSlug={account}
        staff={detail.staff}
        templates={detail.templates}
        branches={detail.branches}
        openRequests={openRequests}
      />
    </ModuleDataSection>
  );
}
