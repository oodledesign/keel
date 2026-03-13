'use client';

import { useRouter } from 'next/navigation';

import { ClientDetailSidebar } from './client-detail-sidebar';

type Props = {
  accountSlug: string;
  accountId: string;
  clientId: string;
  canEditClients: boolean;
  isContractorView: boolean;
  clientsListHref: string;
};

export function ClientDetailPageContent({
  accountSlug,
  accountId,
  clientId,
  canEditClients,
  isContractorView,
  clientsListHref,
}: Props) {
  const router = useRouter();

  const goToList = () => router.push(clientsListHref);

  return (
    <ClientDetailSidebar
      accountSlug={accountSlug}
      accountId={accountId}
      clientId={clientId}
      canEditClients={canEditClients}
      isContractorView={isContractorView}
      onClose={goToList}
      onSaved={goToList}
      onDeleted={goToList}
      fullPage
    />
  );
}
