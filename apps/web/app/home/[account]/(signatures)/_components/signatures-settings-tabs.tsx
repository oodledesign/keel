'use client';

import type { ReactNode } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

export type SignaturesSettingsTab = 'custom-data' | 'integrations';

export function SignaturesSettingsTabs({
  defaultTab = 'custom-data',
  customData,
  integrations,
}: {
  defaultTab?: SignaturesSettingsTab;
  customData: ReactNode;
  integrations: ReactNode;
}) {
  return (
    <Tabs defaultValue={defaultTab} className="w-full space-y-6">
      <TabsList className="h-auto w-full justify-start gap-1 rounded-lg bg-[color-mix(in_srgb,var(--workspace-shell-text)_6%,transparent)] p-1 sm:w-auto">
        <TabsTrigger
          value="custom-data"
          data-test="settings-tab-custom-data"
          className="rounded-md data-[state=active]:bg-[var(--ozer-surface-panel)] data-[state=active]:text-[var(--workspace-shell-text)] data-[state=active]:shadow-xs"
        >
          Custom data
        </TabsTrigger>
        <TabsTrigger
          value="integrations"
          data-test="settings-tab-integrations"
          className="rounded-md data-[state=active]:bg-[var(--ozer-surface-panel)] data-[state=active]:text-[var(--workspace-shell-text)] data-[state=active]:shadow-xs"
        >
          Integrations
        </TabsTrigger>
      </TabsList>

      <TabsContent value="custom-data" className="mt-0 space-y-6">
        {customData}
      </TabsContent>

      <TabsContent value="integrations" className="mt-0 space-y-6">
        {integrations}
      </TabsContent>
    </Tabs>
  );
}
