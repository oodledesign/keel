import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';
import {
  TeamAccountDangerZone,
  TeamAccountSettingsContainer,
} from '@kit/team-accounts/components';

import { ProductTourSettingsCard } from '~/components/product-tour/product-tour-settings-card';
import featuresFlagConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import { createInvoicePaymentSettingsService } from '~/home/[account]/invoices/_lib/server/invoice-payment-settings.service';
import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { resolveTeamProductTourId } from '~/lib/product-tour/tour-steps';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../_lib/role-access';
import { isBusinessProfile } from '../_lib/workspace-profile';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { CommercialNavModulesSettingsForm } from './_components/commercial-nav-modules-settings-form';
import { WorkspaceContactSettingsForm } from './_components/workspace-contact-settings-form';
import { WorkspaceCurrencySettingsForm } from './_components/workspace-currency-settings-form';
import { WorkspaceDashboardShortcutsSection } from './_components/workspace-dashboard-shortcuts-section';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:settings:pageTitle');

  return {
    title,
  };
};

interface TeamAccountSettingsPageProps {
  params: Promise<{ account: string }>;
}

const paths = {
  teamAccountSettings: pathsConfig.app.accountSettings,
};

async function TeamAccountSettingsPage(props: TeamAccountSettingsPageProps) {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();
  const api = createTeamAccountsApi(client);
  const slug = (await props.params).account;
  const workspace = await loadTeamWorkspace(slug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewSettings) {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  const data = await api.getTeamAccount(slug);
  const brand = await loadAccountBrandResolved(data.id);

  const account = {
    id: data.id,
    name: data.name,
    pictureUrl:
      toSupabasePublicStorageUrl(data.picture_url) ??
      toSupabasePublicStorageUrl(brand.logo_url),
    slug: data.slug as string,
    primaryOwnerUserId: data.primary_owner_user_id,
  };

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('company_role')
    .eq('account_id', account.id)
    .eq('user_id', user.id)
    .maybeSingle();

  const isClient = membership?.company_role === 'client';
  const canEditContact = access.isOwner || access.isAdmin;
  const features = {
    enableTeamDeletion: featuresFlagConfig.enableTeamDeletion,
  };

  let stripeConnected = false;
  try {
    const paymentSettings = await createInvoicePaymentSettingsService(
      client,
    ).getSettings(account.id);
    stripeConnected = Boolean(
      paymentSettings.stripe_connect_enabled &&
      paymentSettings.stripe_account_id,
    );
  } catch {
    stripeConnected = false;
  }

  const productTourId = resolveTeamProductTourId(workspace.workspaceProfile);

  return (
    <div className="flex flex-col gap-6">
      {!isClient && productTourId ? (
        <ProductTourSettingsCard
          tourId={productTourId}
          accountSlug={account.slug}
        />
      ) : null}
      {!isClient && workspace.workspaceProfile === 'commercial_property' ? (
        <CommercialNavModulesSettingsForm
          accountId={account.id}
          initialSettings={workspace.moduleSettings}
          canEdit={canEditContact}
        />
      ) : null}
      {!isClient ? (
        <WorkspaceCurrencySettingsForm
          accountId={account.id}
          accountSlug={account.slug}
          initialCurrency={workspace.defaultCurrency}
          canEdit={canEditContact}
          stripeConnected={stripeConnected}
        />
      ) : null}
      {!isClient ? (
        <WorkspaceContactSettingsForm
          accountId={account.id}
          canEdit={canEditContact}
          initial={{
            contact_email: brand.contact_email ?? data.email ?? null,
            phone: brand.phone,
            website_url: brand.website_url,
          }}
        />
      ) : null}
      {!isClient ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]">
          <div>
            <h2 className="text-base font-semibold">Desktop recorder</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              API tokens and monthly usage limits are managed in your personal
              settings. Pro and above include unlimited recorder time; Personal
              and Free include 5 hours per person per month.
            </p>
          </div>
          <Link
            href={pathsConfig.app.personalAccountSettings}
            className="inline-flex text-sm font-medium text-[var(--ozer-accent)] hover:underline"
          >
            Open personal settings →
          </Link>
        </div>
      ) : null}

      {!isClient ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]">
          <div>
            <h2 className="text-base font-semibold">Dashboard shortcuts</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Pin quick links to the top of this workspace&apos;s dashboard.
            </p>
          </div>
          <WorkspaceDashboardShortcutsSection
            accountId={account.id}
            accountSlug={account.slug}
            showLayoutPresets={workspace.workspaceProfile === 'work_design'}
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-6 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]">
        {isClient ? (
          <TeamAccountDangerZone
            account={account}
            primaryOwnerUserId={account.primaryOwnerUserId}
            features={features}
          />
        ) : (
          <TeamAccountSettingsContainer
            account={account}
            paths={paths}
            features={features}
            showLogo={!isBusinessProfile(workspace.workspaceProfile)}
          />
        )}
      </div>
    </div>
  );
}

export default TeamAccountSettingsPage;
