/**
 * Shared marketing site classes — Ozer tokens + crisp interaction defaults.
 * See DESIGN_SYSTEM.md and apps/web/styles/marketing.css
 */

const easeOut = 'ease-[cubic-bezier(0.23,1,0.32,1)]';

export const marketingShellClass = 'marketing-shell';

export const marketingHeader = 'marketing-header';

export const marketingFeatureCard = 'marketing-feature-card';

export const marketingSectionMuted = 'marketing-section-muted';

export const marketingBtnPress =
  `transition-[transform,background-color,opacity,border-color] duration-[160ms] ${easeOut} active:scale-[0.97]`;

export const marketingBtnPrimary = `h-11 rounded-full bg-[var(--ozer-accent)] px-6 text-[var(--ozer-plum-950)] hover:bg-[var(--ozer-accent-hover)] hover:text-[var(--ozer-white)] ${marketingBtnPress}`;

export const marketingBtnGradient = `h-11 rounded-full bg-gradient-to-r from-[var(--ozer-accent)] to-[var(--ozer-info)] px-6 text-[var(--ozer-white)] hover:opacity-95 ${marketingBtnPress}`;

export const marketingBtnOutline = `h-11 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/70 px-6 text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-panel-hover)] ${marketingBtnPress}`;

export const marketingEyebrow =
  'inline-flex items-center rounded-full border border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[var(--ozer-coral-600)] dark:text-[var(--ozer-accent-muted)]';

export const marketingHeadlineGradient =
  'bg-gradient-to-r from-[var(--ozer-accent)] via-[var(--ozer-coral-100)] to-[var(--ozer-info)] bg-clip-text text-transparent';

export const marketingCard =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/80';

export const marketingCardHover =
  'transition-[border-color,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-[var(--ozer-accent)]/30 hover:bg-[var(--workspace-shell-panel-hover)]';

export const marketingPanelDeep =
  'rounded-3xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/85 shadow-[0_30px_100px_rgba(53,30,40,0.12)] dark:shadow-[0_30px_100px_rgba(53,30,40,0.45)] backdrop-blur';

export const marketingPanelInner =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)]';

export const marketingIconAccent = 'text-[var(--ozer-accent)]';

export const marketingIconWell =
  'flex items-center justify-center rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-alpha-08)] text-[var(--ozer-accent)] dark:bg-[var(--workspace-shell-sidebar-accent)]';

export const marketingFeaturedPlan =
  'border-[var(--ozer-accent)] bg-[var(--workspace-shell-panel)] shadow-[0_0_0_1px_var(--ozer-coral-alpha-45)]';

export const marketingPlanBadge =
  'rounded-full bg-[var(--ozer-accent)] px-3 py-0.5 text-xs font-semibold text-[var(--ozer-plum-950)]';

export const marketingMutedText = 'text-[var(--workspace-shell-text-muted)]';

export const marketingNavPanel =
  'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/98 text-[var(--workspace-shell-text)]';
