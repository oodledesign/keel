# Unified Platform Cutover Runbook

This runbook defines staged dual-write cutover for feedflow and rankly into the keel-based platform.

## Module order

1. feedflow
2. rankly

## Preconditions

- Unified migrations applied (including `platform_merge.*` tables).
- Legacy->unified ID mappings populated for users, accounts/orgs, clients, and projects.
- Sync jobs are running and reporting in `platform_merge.sync_runs`.
- Drift checks are producing recent rows in `platform_merge.drift_checks`.

## Validation gates per cohort

### Data parity

- Row count parity for critical entities:
  - feedflow: social accounts, widgets, feed cache, videos
  - rankly: projects, keywords, rankings, backlinks, alerts
- Sampled payload parity for at least 20 records per critical entity.

### Permission parity

- RLS matrix pass for owner/admin/member/viewer in each migrated table.
- `public.is_account_member` and `public.is_account_admin` behavior verified for cohort users.

### Runtime parity

- Cron jobs complete for cohort tenants.
- Webhooks (billing/social/video) are processed without error.
- OAuth callbacks complete with session and account resolution.

## Flip sequence per cohort

1. Enable unified read path.
2. Observe for one full business cycle.
3. Enable unified writes while dual-write remains active.
4. Compare drift for 24h.
5. Disable legacy writes.
6. Mark cohort fully migrated.

## Rollback

- Re-enable legacy read path and keep legacy writes authoritative.
- Pause unified writes for affected module/tenant cohorts.
- Use `platform_merge.sync_runs` records to identify replay window.
