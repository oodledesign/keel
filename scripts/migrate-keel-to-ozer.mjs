#!/usr/bin/env node
/**
 * One-shot Keel → Ozer rename across source files (not node_modules / .git / lockfile).
 * Run from repo root: node scripts/migrate-keel-to-ozer.mjs
 */
import { execSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

/** Ordered longest-first to avoid partial replacements. */
const TEXT_REPLACEMENTS = [
  // Stripe / product catalog IDs
  ['ozer-addon-email-assistant', 'ozer-addon-email-assistant'],
  ['ozer-addon-signatures', 'ozer-addon-signatures'],
  ['ozer-addon-videos-starter', 'ozer-addon-videos-starter'],
  ['ozer-addon-videos-growth', 'ozer-addon-videos-growth'],
  ['ozer-addon-videos-studio', 'ozer-addon-videos-studio'],
  ['ozer-addon-videos-pro', 'ozer-addon-videos-pro'],
  ['ozer-addon-feedflow', 'ozer-addon-feedflow'],
  ['ozer-addon-rankly', 'ozer-addon-rankly'],
  ['ozer-property-portfolio', 'ozer-property-portfolio'],
  ['ozer-property-starter', 'ozer-property-starter'],
  ['ozer-business-scale', 'ozer-business-scale'],
  ['ozer-business-team', 'ozer-business-team'],
  ['ozer-business-solo', 'ozer-business-solo'],
  ['ozer-business-lite', 'ozer-business-lite'],
  ['ozer-community', 'ozer-community'],

  // Price ID fallbacks
  ['price_ozer_', 'price_ozer_'],

  // Types / exports
  ['OzerPlanDefinition', 'OzerPlanDefinition'],
  ['OzerPlanFamily', 'OzerPlanFamily'],
  ['OzerPlanLimits', 'OzerPlanLimits'],
  ['OzerAddonKey', 'OzerAddonKey'],
  ['OzerPersonalAddonKey', 'OzerPersonalAddonKey'],
  ['OZER_PERSONAL_ADDON_CATALOG', 'OZER_PERSONAL_ADDON_CATALOG'],
  ['OZER_ADDON_CATALOG', 'OZER_ADDON_CATALOG'],
  ['OZER_PLAN_CATALOG', 'OZER_PLAN_CATALOG'],
  ['OZER_STRIPE_PRICES', 'OZER_STRIPE_PRICES'],
  ['OZER_BILLING_CURRENCY', 'OZER_BILLING_CURRENCY'],

  // Components / symbols
  ['OzerAddonCheckoutSection', 'OzerAddonCheckoutSection'],
  ['OzerWorkspaceCheckoutForm', 'OzerWorkspaceCheckoutForm'],
  ['OzerAppsMarketplace', 'OzerAppsMarketplace'],
  ['OzerUsePreferencesSection', 'OzerUsePreferencesSection'],
  ['OzerUsePreferencesForm', 'OzerUsePreferencesForm'],
  ['OzerContextsStep', 'OzerContextsStep'],
  ['OzerDashboard', 'OzerDashboard'],
  ['OzerBrandingGuide', 'OzerBrandingGuide'],
  ['OzerAdminDashboard', 'OzerAdminDashboard'],
  ['OzerSidebarLogo', 'OzerSidebarLogo'],
  ['OzerLogoMark', 'OzerLogoMark'],
  ['OzerCalendar', 'OzerCalendar'],
  ['registerOzerPolicies', 'registerOzerPolicies'],
  ['syncStarlingToOzer', 'syncStarlingToOzer'],
  ['syncFreeAgentToOzer', 'syncFreeAgentToOzer'],
  ['loadOzerDashboard', 'loadOzerDashboard'],

  // Paths / modules (import strings)
  ['ozer-addon-checkout-section', 'ozer-addon-checkout-section'],
  ['ozer-workspace-checkout-form', 'ozer-workspace-checkout-form'],
  ['ozer-apps-marketplace', 'ozer-apps-marketplace'],
  ['ozer-use-preferences-section', 'ozer-use-preferences-section'],
  ['ozer-use-preferences-form', 'ozer-use-preferences-form'],
  ['ozer-contexts-step', 'ozer-contexts-step'],
  ['ozer-dashboard.loader', 'ozer-dashboard.loader'],
  ['ozer-dashboard', 'ozer-dashboard'],
  ['ozer-branding-guide', 'ozer-branding-guide'],
  ['ozer-admin-dashboard', 'ozer-admin-dashboard'],
  ['ozer-sidebar-logo', 'ozer-sidebar-logo'],
  ['ozer-logo-mark', 'ozer-logo-mark'],
  ['ozer-plan-catalog', 'ozer-plan-catalog'],
  ['register-ozer-policies', 'register-ozer-policies'],

  // DB / prefs columns
  ['use_ozer_for_work', 'use_ozer_for_work'],
  ['use_ozer_for_family', 'use_ozer_for_family'],
  ['use_ozer_for_community', 'use_ozer_for_community'],

  // CSS classes + var() usages (keep --keel-* aliases in tokens for one release)
  ['ozer-gradient-btn', 'ozer-gradient-btn'],
  ['ozer-gradient-active', 'ozer-gradient-active'],
  ['var(--ozer-accent)', 'var(--ozer-accent)'],
  ['var(--ozer-accent-hover)', 'var(--ozer-accent-hover)'],
  ['var(--ozer-info)', 'var(--ozer-info)'],
  ['var(--ozer-gradient-active-from)', 'var(--ozer-gradient-active-from)'],
  ['var(--ozer-gradient-active-to)', 'var(--ozer-gradient-active-to)'],
  ['var(--ozer-gradient-active-hover-from)', 'var(--ozer-gradient-active-hover-from)'],
  ['var(--ozer-gradient-active-hover-to)', 'var(--ozer-gradient-active-hover-to)'],

  // Storage / UA / copy
  ['ozer-planner-preferences', 'ozer-planner-preferences'],
  ['ozer-planner-plan:', 'ozer-planner-plan:'],
  ['ozer-static-v7', 'ozer-static-v7'],
  ['Scheduled by Ozer', 'Scheduled by Ozer'],
  ['User-Agent]: \'Keel/1.0\'', 'User-Agent]: \'Ozer/1.0\''],
  ["'User-Agent': 'Ozer/1.0'", "'User-Agent': 'Ozer/1.0'"],
  ["'user-agent': 'Ozer/1.0'", "'user-agent': 'Ozer/1.0'"],
  ['mailto:hi@ozer.so', 'mailto:hi@ozer.so'],
  ['Ozer can block time', 'Ozer can block time'],
  ['Ozer Assistant', 'Ozer Assistant'],
  ['title: \'Keel\'', "title: 'Ozer'"],
  ['title: "Ozer"', 'title: "Ozer"'],

  // Docs / comments high-signal
  ['# Stripe setup for Ozer', '# Stripe setup for Ozer'],
  ['Ozer already integrates Stripe', 'Ozer already integrates Stripe'],
  ['Ozer onboard businesses', 'Ozer onboard businesses'],
  ['Ozer does not take an application fee', 'Ozer does not take an application fee'],
  ['# Ozer Design System', '# Ozer Design System'],
];

const FILE_RENAMES = [
  [
    'apps/web/lib/billing/ozer-plan-catalog.ts',
    'apps/web/lib/billing/ozer-plan-catalog.ts',
  ],
  [
    'apps/web/lib/billing/register-ozer-policies.ts',
    'apps/web/lib/billing/register-ozer-policies.ts',
  ],
  [
    'apps/web/app/home/[account]/billing/_components/ozer-addon-checkout-section.tsx',
    'apps/web/app/home/[account]/billing/_components/ozer-addon-checkout-section.tsx',
  ],
  [
    'apps/web/app/home/[account]/billing/_components/ozer-workspace-checkout-form.tsx',
    'apps/web/app/home/[account]/billing/_components/ozer-workspace-checkout-form.tsx',
  ],
  [
    'apps/web/app/home/[account]/apps/_components/ozer-apps-marketplace.tsx',
    'apps/web/app/home/[account]/apps/_components/ozer-apps-marketplace.tsx',
  ],
  [
    'apps/web/app/home/(user)/settings/_components/ozer-use-preferences-section.tsx',
    'apps/web/app/home/(user)/settings/_components/ozer-use-preferences-section.tsx',
  ],
  [
    'apps/web/app/home/(user)/settings/_components/ozer-use-preferences-form.tsx',
    'apps/web/app/home/(user)/settings/_components/ozer-use-preferences-form.tsx',
  ],
  [
    'apps/web/app/home/(user)/_components/dashboard/ozer-dashboard.tsx',
    'apps/web/app/home/(user)/_components/dashboard/ozer-dashboard.tsx',
  ],
  [
    'apps/web/app/home/(user)/_lib/server/ozer-dashboard.loader.ts',
    'apps/web/app/home/(user)/_lib/server/ozer-dashboard.loader.ts',
  ],
  [
    'apps/web/app/onboarding/_components/steps/ozer-contexts-step.tsx',
    'apps/web/app/onboarding/_components/steps/ozer-contexts-step.tsx',
  ],
  [
    'apps/web/app/admin/_components/ozer-branding-guide.tsx',
    'apps/web/app/admin/_components/ozer-branding-guide.tsx',
  ],
  [
    'apps/web/app/admin/_components/ozer-admin-dashboard.tsx',
    'apps/web/app/admin/_components/ozer-admin-dashboard.tsx',
  ],
  [
    'apps/web/components/calendar/OzerCalendar.tsx',
    'apps/web/components/calendar/OzerCalendar.tsx',
  ],
  // ozer-sidebar-logo / ozer-logo-mark already have Ozer successors — delete wrappers after text pass
];

const FILE_DELETES = [
  'apps/web/components/workspace-shell/ozer-sidebar-logo.tsx',
  'apps/web/components/ozer-logo-mark.tsx',
];

function listFiles() {
  const out = execSync(
    `find . -type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' -o -name '*.css' -o -name '*.md' -o -name '*.mdoc' -o -name '*.json' -o -name '*.toml' -o -name '*.html' \\) ` +
      `! -path './node_modules/*' ! -path './.git/*' ! -path './**/node_modules/*' ! -path './**/.next/*' ! -path './**/dist/*' ! -path './pnpm-lock.yaml' ! -path './apps/web/supabase/migrations/*'`,
    { cwd: ROOT, maxBuffer: 50 * 1024 * 1024, encoding: 'utf8' },
  );
  return out.split('\n').filter(Boolean).map((p) => p.replace(/^\.\//, ''));
}

function applyReplacements(content) {
  let next = content;
  for (const [from, to] of TEXT_REPLACEMENTS) {
    if (next.includes(from)) {
      next = next.split(from).join(to);
    }
  }
  return next;
}

function main() {
  const files = listFiles();
  let changed = 0;

  for (const rel of files) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue;
    let content;
    try {
      content = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const next = applyReplacements(content);
    if (next !== content) {
      writeFileSync(abs, next);
      changed += 1;
      console.log(`updated ${rel}`);
    }
  }

  for (const [from, to] of FILE_RENAMES) {
    const fromAbs = join(ROOT, from);
    const toAbs = join(ROOT, to);
    if (!existsSync(fromAbs)) {
      console.warn(`skip rename (missing): ${from}`);
      continue;
    }
    mkdirSync(dirname(toAbs), { recursive: true });
    if (existsSync(toAbs)) {
      console.warn(`skip rename (target exists): ${to}`);
      continue;
    }
    renameSync(fromAbs, toAbs);
    console.log(`renamed ${from} → ${to}`);
  }

  for (const rel of FILE_DELETES) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue;
    unlinkSync(abs);
    console.log(`deleted ${rel}`);
  }

  console.log(`\nDone. Files updated: ${changed}`);
}

main();
