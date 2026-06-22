# Keel Design System

Brand-aligned tokens for the Keel workspace shell (sidebar, top bar, cards, and actions).

## Typography

- **Font:** [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts via `next/font`)
- **Headings:** weight `700`
- **Navigation labels:** weight `500`
- **Body:** weight `400`

## Colours

| Token | Value | Usage |
|-------|--------|--------|
| Primary CTA | `#2A9D8F` (flat teal) | Primary action buttons (`keel-gradient-btn`) |
| Primary gradient | `#152544` → `#18352F` (subtle panel wash) | Active nav, selected tabs |
| Background (page) | `#0B132B` | Main canvas (`--workspace-shell-canvas`) |
| Sidebar / cards | `#0F1B35` | Sidebar, panels (`--workspace-shell-panel`) |
| Accent blue | `#2563EB` | Links, focus ring, info |
| Teal | `#2A9D8F` | Highlights, success, primary |
| Text on dark | `#FFFFFF` | Sidebar and dark workspace UI |
| Text on light | `#1E293B` | Light marketing / documents |

CSS variables: `--keel-gradient-from`, `--keel-gradient-to`, `--keel-gradient-hover-from`, `--keel-gradient-hover-to`, `--keel-teal`, `--keel-teal-hover`, `--keel-accent-blue`. Utility classes: `keel-gradient-btn` (flat teal primary CTA), `keel-gradient-active`.

## Workspace shell

### Sidebar (all workspaces)

- Fixed width **240px** (`15rem`, `--sidebar-width`)
- **Top:** Keel logo (`/brand/keel-white-transparent.png` on dark sidebar), then workspace switcher (avatar, name, role badge, chevron)
- **Nav:** icon + label, **40px** row height, **12px** horizontal padding; active item uses primary gradient; hover uses subtle white tint
- Nav items from `account_module_settings` (enabled modules), ordered per `config/workspace-module-order.ts`
- No “Application” / “Settings” section headings — **8px** gap between nav groups (`mt-2` on adjacent groups)
- **Bottom:** collapse control, then profile block (avatar, display name, email, chevron)

### Top bar (all workspaces)

- Transparent background (blends with page)
- **Right only:** notifications, Search (outlined + ⌘K pill), **New** (teal flat + chevron dropdown)
- No floating action button in the shell

### Logos

| Asset | Path |
|--------|------|
| Dark sidebar / dark UI | `apps/web/public/brand/keel-white-transparent.png` |
| Light surfaces | `apps/web/public/brand/keel-dark-transparent.png` |
| Collapsed sidebar icon | `apps/web/public/brand/keel-icon.png` |

## Implementation map

- Tokens: `apps/web/styles/shadcn-ui.css`
- Fonts: `apps/web/lib/fonts.ts`
- Shell components: `apps/web/components/workspace-shell/*`
- Team sidebar: `apps/web/app/home/[account]/_components/team-account-layout-sidebar.tsx`
- Personal sidebar: `apps/web/app/home/(user)/_components/home-sidebar.tsx`
- Module order: `apps/web/config/workspace-module-order.ts`
