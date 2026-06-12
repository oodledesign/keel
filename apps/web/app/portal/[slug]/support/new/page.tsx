import { PortalSupportNewForm } from '../../_components/portal-support-content';
import { loadClientPortalContext } from '../../_lib/server/client-portal.loader';

interface PortalSupportNewPageProps {
  params: Promise<{ slug: string }>;
}

export const generateMetadata = async () => ({ title: 'Raise a ticket' });

export default async function PortalSupportNewPage({
  params,
}: PortalSupportNewPageProps) {
  const { slug } = await params;
  const ctx = await loadClientPortalContext(slug);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Raise a ticket</h2>
        <p className="mt-1 text-sm text-slate-500">
          Tell us what you need help with and we&apos;ll respond as soon as we can.
        </p>
      </div>

      <PortalSupportNewForm
        clientOrgId={ctx.clientOrgId}
        accountId={ctx.accountId}
        clientSlug={slug}
      />
    </div>
  );
}
