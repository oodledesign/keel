import Link from 'next/link';
import { revalidatePath } from 'next/cache';

import { Button } from '@kit/ui/button';
import { PageBody } from '@kit/ui/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export const metadata = { title: 'Areas & modules' };

type SpaceType = 'work' | 'family' | 'community';

const SPACE_MODULES: Record<SpaceType, Array<string>> = {
  work: ['clients', 'pipeline', 'jobs', 'invoices', 'team', 'schedule'],
  family: ['calendar', 'shopping', 'meal_plan'],
  community: ['schedule', 'tasks', 'notes'],
};

async function setAccountModuleEnabled(formData: FormData) {
  'use server';

  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();

  const accountId = String(formData.get('accountId') ?? '');
  const moduleKey = String(formData.get('moduleKey') ?? '');
  const enabled = String(formData.get('enabled') ?? '') === 'true';

  if (!accountId || !moduleKey) {
    return;
  }

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || !['owner', 'admin'].includes(membership.account_role)) {
    return;
  }

  await client.from('account_module_settings').upsert(
    {
      account_id: accountId,
      module_key: moduleKey,
      enabled,
    },
    {
      onConflict: 'account_id,module_key',
    },
  );

  revalidatePath('/app/settings/areas');
}

async function AreasSettingsPage() {
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();

  const { data: memberships } = await client
    .from('accounts_memberships')
    .select(
      'account_role, account:accounts!inner(id, name, slug, space_type, is_personal_account)',
    )
    .eq('user_id', user.id)
    .in('account_role', ['owner', 'admin']);

  const managedAccounts = (memberships ?? [])
    .map((membership) => {
      const account = membership.account as {
        id: string;
        name: string;
        slug: string | null;
        space_type: SpaceType | null;
        is_personal_account: boolean;
      };

      return account;
    })
    .filter((account) => !account.is_personal_account && !!account.space_type);

  const accountIds = managedAccounts.map((account) => account.id);
  const { data: moduleRows } = accountIds.length
    ? await client
        .from('account_module_settings')
        .select('account_id, module_key, enabled')
        .in('account_id', accountIds)
    : { data: [] as Array<{ account_id: string; module_key: string; enabled: boolean }> };

  const settingsMap = new Map<string, boolean>();
  for (const row of moduleRows ?? []) {
    settingsMap.set(`${row.account_id}:${row.module_key}`, row.enabled);
  }

  const groupedAccounts: Record<SpaceType, typeof managedAccounts> = {
    work: managedAccounts.filter((account) => account.space_type === 'work'),
    family: managedAccounts.filter((account) => account.space_type === 'family'),
    community: managedAccounts.filter(
      (account) => account.space_type === 'community',
    ),
  };

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)]">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="space-y-1">
          <h1 className="text-[1.5rem] font-semibold tracking-tight">
            Areas & modules
          </h1>
          <p className="text-muted-foreground text-sm">
            Per-space module toggles (owner/admin only) will live here. Off
            hides modules across nav and entry points.
          </p>
        </div>

        <Tabs defaultValue="work" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="work">Work</TabsTrigger>
            <TabsTrigger value="family">Family</TabsTrigger>
            <TabsTrigger value="community">Community</TabsTrigger>
          </TabsList>
          <TabsContent value="work" className="mt-4 rounded-lg border p-4">
            <AccountModuleList
              accounts={groupedAccounts.work}
              settingsMap={settingsMap}
              spaceType="work"
            />
          </TabsContent>
          <TabsContent value="family" className="mt-4 rounded-lg border p-4">
            <AccountModuleList
              accounts={groupedAccounts.family}
              settingsMap={settingsMap}
              spaceType="family"
            />
          </TabsContent>
          <TabsContent value="community" className="mt-4 rounded-lg border p-4">
            <AccountModuleList
              accounts={groupedAccounts.community}
              settingsMap={settingsMap}
              spaceType="community"
            />
          </TabsContent>
        </Tabs>

        <Link
          href={pathsConfig.app.personalAccountSettings}
          className="text-primary text-sm font-medium underline-offset-4 hover:underline"
        >
          Back to settings
        </Link>
      </div>
    </PageBody>
  );
}

function AccountModuleList(props: {
  accounts: Array<{
    id: string;
    name: string;
    slug: string | null;
    space_type: SpaceType | null;
    is_personal_account: boolean;
  }>;
  settingsMap: Map<string, boolean>;
  spaceType: SpaceType;
}) {
  if (!props.accounts.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No {props.spaceType} spaces you can manage yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {props.accounts.map((account) => (
        <div key={account.id} className="rounded-lg border border-[color:var(--workspace-shell-border)] p-4">
          <h3 className="text-sm font-semibold">{account.name}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {SPACE_MODULES[props.spaceType].map((moduleKey) => {
              const mapKey = `${account.id}:${moduleKey}`;
              const enabled = props.settingsMap.get(mapKey) ?? true;

              return (
                <form action={setAccountModuleEnabled} key={moduleKey}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <input type="hidden" name="moduleKey" value={moduleKey} />
                  <input
                    type="hidden"
                    name="enabled"
                    value={enabled ? 'false' : 'true'}
                  />
                  <Button
                    type="submit"
                    variant={enabled ? 'default' : 'outline'}
                    size="sm"
                  >
                    {moduleKey.replace('_', ' ')}: {enabled ? 'On' : 'Off'}
                  </Button>
                </form>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default withI18n(AreasSettingsPage);
