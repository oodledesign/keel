export type MergeModule = 'feedflow' | 'rankly';

export type TenantCohort = {
  slug: string;
  module: MergeModule;
  readPathEnabled: boolean;
  writePathEnabled: boolean;
  parityChecksPassed: boolean;
};

// Initial static cohort list used while we stand up staged cutover.
// This can be replaced with DB-backed configuration once the sync loops are live.
export const tenantCutoverCohorts: TenantCohort[] = [
  {
    slug: 'pilot-feedflow-01',
    module: 'feedflow',
    readPathEnabled: true,
    writePathEnabled: false,
    parityChecksPassed: false,
  },
  {
    slug: 'pilot-rankly-01',
    module: 'rankly',
    readPathEnabled: true,
    writePathEnabled: false,
    parityChecksPassed: false,
  },
];
