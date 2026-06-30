# Keel / Ozer Design System

Brand-aligned tokens for the Ozer workspace shell, Shadcn UI, and shared components.

## How to change the brand (quick reference)

1. **Colours, gradients, radii** — edit **`apps/web/styles/ozer-tokens.css`** (primitives + semantic section).
2. **App shell mapping** — usually no change needed; `shadcn-ui.css` reads semantic tokens automatically.
3. **Fonts** — update the Fontshare `@import` in `ozer-tokens.css` and `--ozer-font-*` variables.
4. **Component utilities** — prefer `var(--ozer-*)` or legacy `var(--keel-teal)`; avoid new hardcoded hex in TS/TSX.
5. **Logos** — replace files under `apps/web/public/brand/` (wordmark, icon, favicon).

Legacy `--keel-*` variables are aliases to `--ozer-*` so existing code keeps working during migration.

---

## Typography

| Role | Font | Weight | CSS variable |
|------|------|--------|--------------|
| Body | General Sans (Fontshare) | 400 | `--ozer-font-body` |
| Navigation | General Sans | 500 | `--ozer-font-weight-nav` |
| Headings / display | Cabinet Grotesk (Fontshare) | 700 | `--ozer-font-display` |

Loaded via Fontshare at the top of `globals.css` (with preconnect in root layout). Shadcn maps `--font-sans` → body, `--font-heading` → Cabinet Grotesk via `--ozer-font-display`.

---

## Colour primitives (from brand guide)

| Token | Hex | Usage |
|-------|-----|--------|
| `--ozer-plum-900` | `#351E28` | Main canvas background |
| `--ozer-plum-950` | `#2A1720` | Sidebar / panels |
| `--ozer-plum-800` | `#3D2A33` | Panel hover, elevated surfaces |
| `--ozer-coral-500` | `#FF5C34` | Primary accent, CTAs, active nav |
| `--ozer-coral-400` | `#FF7A5C` | Accent hover |
| `--ozer-cream-50` | `#FBF6EC` | Text on dark surfaces |
| `--ozer-text-muted` | `#B7A4AC` | Muted text on light |
| `--ozer-info` | `#41606F` | Links, info accent |

Full list: `apps/web/styles/ozer-tokens.css`

---

## Semantic tokens (prefer these in new code)

| Token | Light mode | Dark mode |
|-------|------------|-----------|
| `--ozer-surface-canvas` | `--ozer-cream-50` | `--ozer-plum-900` |
| `--ozer-surface-panel` | `--ozer-white` | `--ozer-plum-950` |
| `--ozer-surface-panel-hover` | `--ozer-cream-100` | `--ozer-plum-800` |
| `--ozer-accent` | Coral CTA (both) | Coral CTA (both) |
| `--workspace-shell-text` | Plum on cream | Cream on plum |

| `--workspace-shell-nav-text` | Plum nav labels on cream sidebar | Muted cream on plum sidebar |
| `--workspace-shell-text-on-dark` | — | Fixed cream text on forced-dark bands |

**Contrast rule:** On cream/light panels use `--workspace-shell-text` / `-muted`. On fixed plum bands (hero, pricing, interconnected section) use `--ozer-text-on-dark` / `-muted` — never `--workspace-shell-text`, which flips with theme.

Semantic surfaces flip in `ozer-tokens.css` via `.dark` on `<html>`. Static tokens (`--ozer-text-on-dark`, `--ozer-border-on-light`, etc.) stay fixed for contrast pairs.

| Token | Maps to |
|-------|---------|
| `--ozer-accent` | Primary CTA, focus, success highlights |
| `--ozer-accent-hover` | Hover state for primary |
| `--ozer-text-on-dark` | Primary text on plum surfaces |
| `--ozer-border-on-dark` | Dividers on dark UI |
| `--ozer-gradient-active-from` / `--to` | Active sidebar item gradient |

Workspace shell uses `--workspace-shell-*` variables (defined in `shadcn-ui.css`, backed by Ozer semantics).

---

## Legacy aliases (Phase 1 compatibility)

| Old | New |
|-----|-----|
| `--keel-teal` | `--ozer-accent` |
| `--keel-teal-hover` | `--ozer-accent-hover` |
| `--keel-gradient-from` / `--to` | `--ozer-gradient-active-*` |
| `--keel-accent-blue` | `--ozer-info` |

Utility classes: `ozer-gradient-btn` (alias `keel-gradient-btn`), `ozer-gradient-active` (alias `keel-gradient-active`), `workspace-btn-primary` — all use CSS variables.

---

## Workspace shell

### Sidebar (all workspaces)

- Fixed width **240px** (`15rem`, `--sidebar-width`)
- **Top:** Ozer logo (theme-aware SVG wordmark), workspace switcher
- **Nav:** icon + label, **40px** row height; active item uses coral gradient (`keel-gradient-active`)
- **Bottom:** collapse control, profile (team) or moved to top bar (personal)

### Top bar

- Transparent background
- **Right:** notifications, Search (⌘K), **New** (coral primary)

### Logos

| Asset | Path |
|--------|------|
| Wordmark (light surfaces) | `apps/web/public/brand/ozer-wordmark-on-light.svg` |
| Wordmark (dark surfaces) | `apps/web/public/brand/ozer-wordmark-on-dark.svg` |
| Flower icon | `apps/web/public/brand/ozer-icon.svg` |
| Favicon | `apps/web/public/favicon.svg` |
| Brand guide (reference) | `apps/web/public/brand/ozer-brand-guide.html` |

React: `OzerLogoMark`, `OzerSidebarLogo` in `apps/web/components/`.

---

## Light / dark mode (Phase 4)

- **Default:** dark (`NEXT_PUBLIC_DEFAULT_THEME_MODE`, fallback `dark`)
- **User choice:** Settings → Accessibility → Appearance (Light / Dark / System)
- **Persistence:** `localStorage` key `ozer-theme` via `next-themes`
- **Marketing:** `.marketing-shell` uses cream canvas in light mode, plum in `.dark`
- **Not migrated:** hardcoded `text-white` / `text-zinc-*` in some feature modules — prefer `--workspace-shell-*` tokens in new edits

### Token cleanup (post–Phase 4)

App UI should use semantic shell tokens, not Tailwind zinc/white:

| Instead of | Use |
|------------|-----|
| `text-zinc-400` / `text-zinc-300` | `text-[var(--workspace-shell-text-muted)]` |
| `text-white` on panels | `text-[var(--workspace-shell-text)]` |
| `text-white` on coral CTAs | `text-[var(--ozer-white)]` |
| `border-white/6` | `border-[color:var(--workspace-shell-border)]` |
| `bg-zinc-800` / `bg-zinc-900` | `bg-[var(--workspace-control-surface)]` / `bg-[var(--workspace-shell-panel)]` |
| `bg-white/5` overlays | `bg-[var(--workspace-shell-sidebar-accent)]` |

Helpers: `apps/web/lib/workspace-ui.ts` (`workspaceText`, `workspaceTextMuted`, `workspaceBorder`, …).

Programmatic colours (charts, PM status cells, emails): `apps/web/lib/ozer/design-tokens.ts` (`ozerColors`, `ozerStatusColors`).

**Intentionally kept as hex:** email HTML templates, admin branding swatches, decorative marketing showcase gradients, agency white-label portals.

| Surface | Light | Dark |
|---------|-------|------|
| Canvas | `#FBF6EC` cream | `#351E28` plum |
| Panel | `#FFFFFF` | `#2A1720` plum-950 |
| Primary text | `#2A1720` plum | `#FBF6EC` cream |
| Accent | `#FF5C34` coral | `#FF5C34` coral |

---

## Implementation map

| Concern | File |
|---------|------|
| **Brand primitives** | `apps/web/styles/ozer-tokens.css` |
| Shadcn + shell mapping | `apps/web/styles/shadcn-ui.css` |
| Tailwind `@theme` bridge | `apps/web/styles/theme.css` |
| Button utilities | `apps/web/styles/theme.utilities.css`, `makerkit.css` |
| TS class helpers | `apps/web/lib/workspace-ui.ts`, `apps/web/lib/marketing/marketing-ui.ts` |
| Marketing shell utilities | `apps/web/styles/marketing.css` |
| Shell layout classes | `apps/web/components/workspace-shell/workspace-shell-styles.ts` |
| Fonts bootstrap | `apps/web/lib/fonts.ts` |
| Live token preview | `apps/web/app/admin/_components/keel-branding-guide.tsx` |
| Theme toggle (app) | `apps/web/components/appearance-theme-selector.tsx` |
| Theme toggle (marketing) | `apps/web/components/theme-mode-toggle.tsx` |

---

## Rollout phases

| Phase | Scope | Status |
|-------|--------|--------|
| **1** | Token file + shell (sidebar, top bar, primary buttons via CSS vars) | Done |
| **2** | Replace hardcoded hex in feature modules (~224 files) | Done |
| **3** | Marketing site alignment (Ozer tokens, copy, interaction defaults) | Done |
| **4** | Light/dark theme, Ozer logos (SVG), Keel→Ozer naming aliases | Done |

Interactive reference: deploy `ozer-brand-guide.html` or open locally after `npm run dev`.
