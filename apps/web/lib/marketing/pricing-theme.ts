export type PricingTone = 'light' | 'dark';

export type PricingTheme = {
  section: string;
  sectionGlow: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  text: string;
  muted: string;
  card: string;
  cardSelected: string;
  cardUnselected: string;
  panel: string;
  panelInner: string;
  toggleTrack: string;
  togglePill: string;
  toggleText: string;
  toggleTextInactive: string;
  tierPanel: string;
  addonsPanel: string;
  tooltip: string;
  lineLabel: string;
  faqTone: 'light' | 'dark';
};

export function getPricingTheme(tone: PricingTone): PricingTheme {
  if (tone === 'light') {
    return {
      section:
        'relative overflow-hidden bg-[var(--workspace-shell-canvas)] pb-16 pt-4 text-[var(--workspace-shell-text)] md:pb-24 md:pt-6',
      sectionGlow: 'hidden',
      eyebrow:
        'text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workspace-shell-text-muted)]',
      title:
        'mt-3 font-heading text-3xl font-semibold tracking-tight text-[var(--workspace-shell-text)] md:text-5xl',
      subtitle:
        'mt-4 text-base leading-relaxed text-[var(--workspace-shell-text-muted)] md:text-lg',
      text: 'text-[var(--workspace-shell-text)]',
      muted: 'text-[var(--workspace-shell-text-muted)]',
      card: 'bg-[var(--workspace-shell-panel)]',
      cardSelected:
        'border-[var(--ozer-accent)]/50 bg-[var(--ozer-accent-subtle)] shadow-[0_12px_40px_var(--ozer-coral-alpha-15)]',
      cardUnselected:
        'border-[color:var(--workspace-shell-border)] hover:border-[var(--ozer-accent)]/25 hover:shadow-[0_12px_40px_rgba(53,30,40,0.08)]',
      panel:
        'rounded-3xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 backdrop-blur-sm lg:sticky lg:top-24',
      panelInner:
        'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)]',
      toggleTrack:
        'inline-flex items-center gap-2 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-1',
      togglePill: 'bg-[var(--workspace-shell-sidebar-accent)]',
      toggleText: 'text-[var(--workspace-shell-text)]',
      toggleTextInactive:
        'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
      tierPanel:
        'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 sm:p-5',
      addonsPanel:
        'space-y-6 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/90 p-4 sm:p-5',
      tooltip:
        'max-w-[200px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]',
      lineLabel: 'text-[var(--workspace-shell-text-muted)]',
      faqTone: 'light',
    };
  }

  return {
    section:
      'relative overflow-hidden bg-[radial-gradient(circle_at_15%_0%,var(--ozer-coral-alpha-15),transparent_42%),linear-gradient(180deg,var(--ozer-plum-950)_0%,var(--ozer-plum-900)_100%)] pb-24 pt-20 text-[var(--ozer-text-on-dark)] md:pb-32',
    sectionGlow:
      'pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_22%)]',
    eyebrow:
      'text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ozer-text-on-dark-muted)]',
    title:
      'mt-3 font-heading text-3xl font-semibold tracking-tight text-[var(--ozer-text-on-dark)] md:text-5xl',
    subtitle:
      'mt-4 text-base leading-relaxed text-[var(--ozer-text-on-dark-muted)] md:text-lg',
    text: 'text-[var(--ozer-text-on-dark)]',
    muted: 'text-[var(--ozer-text-on-dark-muted)]',
    card: 'bg-[var(--ozer-plum-950)]/60 backdrop-blur-sm',
    cardSelected:
      'border-[var(--ozer-accent)]/60 bg-[var(--ozer-accent-subtle)] shadow-[0_12px_40px_var(--ozer-coral-alpha-15)]',
    cardUnselected:
      'border-[color:var(--workspace-shell-border)] hover:border-[color:var(--workspace-shell-border)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]',
    panel:
      'rounded-3xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)]/70 p-6 backdrop-blur-sm lg:sticky lg:top-24',
    panelInner:
      'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]',
    toggleTrack:
      'inline-flex items-center gap-2 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)]/80 p-1',
    togglePill: 'bg-[var(--ozer-info)]/80',
    toggleText: 'text-[var(--ozer-text-on-dark)]',
    toggleTextInactive:
      'text-[var(--ozer-text-on-dark-muted)] hover:text-[var(--ozer-text-on-dark)]',
    tierPanel:
      'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)]/50 p-4 sm:p-5',
    addonsPanel:
      'space-y-6 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)]/40 p-4 sm:p-5',
    tooltip:
      'max-w-[200px] border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)] text-[var(--ozer-text-on-dark)]',
    lineLabel: 'text-slate-200',
    faqTone: 'dark',
  };
}
