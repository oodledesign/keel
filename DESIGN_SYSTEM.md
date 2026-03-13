# Keel Design System

This document captures the current Keel brand direction based on the uploaded colour and typography boards, plus the approved dashboard reference screens.

## Typography

- Primary UI font: `Poppins`
- Secondary brand/editorial font from brand board: `Roboto Slab`
- Product implementation standard:
  - Use `Poppins` for app UI, navigation, cards, forms, tables, and dashboard content.
  - Reserve `Roboto Slab` for future brand/editorial use only unless a specific screen needs it.

## Typography Scale

- Display / page welcome: `40-48px`, `font-weight: 700-800`
- Section title: `24-30px`, `font-weight: 600-700`
- Card title / feature title: `16-18px`, `font-weight: 600`
- Body / default UI copy: `14-16px`, `font-weight: 400-500`
- Meta / helper / labels: `11-13px`, `font-weight: 500-600`

## Brand Colours

These values are normalized from the Keel colour board and the approved dashboard screenshot.

### Primary

- `brand.steel.500`: `#465B6F`
- `brand.green.500`: `#57C87F`

### Secondary

- `brand.teal.500`: `#1F7F7F`
- `brand.teal.300`: `#39AEB3`
- `brand.teal.200`: `#7DBCBD`
- `brand.teal.100`: `#B8D3D7`

- `brand.purple.500`: `#4B1764`
- `brand.purple.300`: `#8D6BA5`
- `brand.purple.200`: `#B099C7`
- `brand.purple.100`: `#DDD3E9`

- `brand.orange.500`: `#F7923D`
- `brand.orange.300`: `#F4A35F`
- `brand.orange.200`: `#EFC198`
- `brand.sand.200`: `#EEDCC9`

- `brand.green.300`: `#57C87F`
- `brand.green.200`: `#97D9AA`
- `brand.green.100`: `#C7E9D0`
- `brand.green.050`: `#E8F5EC`

### Neutral / UI Surfaces

- `ui.navy.950`: `#060C18`
- `ui.navy.900`: `#09111F`
- `ui.navy.850`: `#0B1524`
- `ui.navy.800`: `#122033`
- `ui.navy.700`: `#1A2740`
- `ui.shell.header`: `#1F2B3A`
- `ui.shell.sidebar`: `#161F2B`
- `ui.shell.canvas`: `#0B111C`
- `ui.shell.panel`: `#171F2C`
- `ui.sidebar.900`: `#0A1422`
- `ui.sidebar.active`: `#1F2C43`
- `ui.sidebar.hover`: `#19263A`

- `ui.text.primary`: `#F7F9FC`
- `ui.text.secondary`: `#D7DEEE`
- `ui.text.muted`: `#AAB4C8`
- `ui.text.subtle`: `#7E889D`

- `ui.border.soft`: `rgba(255,255,255,0.06)`
- `ui.border.strong`: `rgba(255,255,255,0.10)`

### Status

- Success / completed: `#57C87F`
- Info / in progress: `#3B82F6`
- Warning / pending: `#F2C94C`
- Danger / overdue: `#E85D75`

## Gradients

- Dashboard background:
  - `radial-gradient(circle at top, #11213A 0%, #09111F 36%, #060C18 100%)`
- Blue highlight glow:
  - `linear-gradient(90deg, rgba(25,58,122,0) 0%, rgba(39,88,190,0.18) 50%, rgba(25,58,122,0) 100%)`
- Green badge / accent glow:
  - `linear-gradient(135deg, rgba(87,200,127,0.22), rgba(87,200,127,0.06))`

## Dashboard UI Rules

- Sidebar should be darker than the main dashboard canvas.
- Primary cards use:
  - `background: #122033`
  - `border: rgba(255,255,255,0.06)`
  - deep soft shadow
  - large radius: `20-24px`
- Active nav items use the blue selection colour with a subtle inset/highlight feel.
- Compact status chips should use coloured translucent fills rather than solid blocks.
- Tabs should be icon-led where possible on dashboard surfaces.
- Top-right global create button should always stay visible in the account workspace header.

## Interaction Patterns

- Quick create menu:
  - 2x2 grid
  - strong contrast card tiles
  - item icon in a tinted square
  - title + short helper text
- Hover behaviour:
  - lighten background slightly
  - keep motion subtle
  - preserve readability and contrast

## Notes

- This document is the current source of truth for dashboard styling.
- Workspace shell tokens are implemented in `apps/web/styles/shadcn-ui.css`:
  - `--workspace-shell-header`
  - `--workspace-shell-sidebar`
  - `--workspace-shell-canvas`
  - `--workspace-shell-panel`
  - `--workspace-shell-panel-hover`
  - `--workspace-shell-sidebar-active`
- Approved workspace shell colours override the earlier navy-heavy dashboard treatment:
  - Sticky account header uses `#1F2B3A`
  - Sidebar uses `#161F2B`
  - Main workspace canvas uses `#0C141F`
  - Dashboard cards and major panels use `#171F2C`
  - The inner dashboard content surface should remain transparent so the page-level canvas colour shows through
- If a screen conflicts with this doc and the approved visual references, update this file first, then implement.
