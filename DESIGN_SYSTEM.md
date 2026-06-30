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

Loaded via Fontshare in `ozer-tokens.css`. Shadcn maps `--font-sans` → body, `--font-heading` → display.

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

| Token | Maps to |
|-------|---------|
| `--ozer-accent` | Primary CTA, focus, success highlights |
| `--ozer-accent-hover` | Hover state for primary |
| `--ozer-surface-canvas` | Page background |
| `--ozer-surface-panel` | Cards, sidebar |
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

Utility classes: `keel-gradient-btn`, `keel-gradient-active`, `workspace-btn-primary` — all use CSS variables.

---

## Workspace shell

### Sidebar (all workspaces)

- Fixed width **240px** (`15rem`, `--sidebar-width`)
- **Top:** Ozer logo (`/brand/ozer-wordmark.png`), workspace switcher
- **Nav:** icon + label, **40px** row height; active item uses coral gradient (`keel-gradient-active`)
- **Bottom:** collapse control, profile (team) or moved to top bar (personal)

### Top bar

- Transparent background
- **Right:** notifications, Search (⌘K), **New** (coral primary)

### Logos

| Asset | Path |
|--------|------|
| Wordmark | `apps/web/public/brand/ozer-wordmark.png` |
| Icon / favicon | `apps/web/public/brand/ozer-icon.png` |
| Brand guide (reference) | `apps/web/public/brand/ozer-brand-guide.html` |

---

## Implementation map

| Concern | File |
|---------|------|
| **Brand primitives** | `apps/web/styles/ozer-tokens.css` |
| Shadcn + shell mapping | `apps/web/styles/shadcn-ui.css` |
| Tailwind `@theme` bridge | `apps/web/styles/theme.css` |
| Button utilities | `apps/web/styles/theme.utilities.css`, `makerkit.css` |
| TS class helpers | `apps/web/lib/workspace-ui.ts` |
| Shell layout classes | `apps/web/components/workspace-shell/workspace-shell-styles.ts` |
| Fonts bootstrap | `apps/web/lib/fonts.ts` |
| Live token preview | `apps/web/app/admin/_components/keel-branding-guide.tsx` |

---

## Rollout phases

| Phase | Scope | Status |
|-------|--------|--------|
| **1** | Token file + shell (sidebar, top bar, primary buttons via CSS vars) | Current |
| **2** | Replace hardcoded hex in feature modules (~90 files) | Planned |
| **3** | Marketing site alignment | Planned |

Interactive reference: deploy `ozer-brand-guide.html` or open locally after `npm run dev`.
