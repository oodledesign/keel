# @kit/site-blocks-workspaces

Workspace-scoped custom blocks for Site Studio. One pack per workspace
(`accounts.slug`), usable across every site in that workspace, in both the
Ozer Sites Puck editor and the public renderer (`apps/sites`).

## The round-trip workflow

```
1. Plan in Site Studio        wireframe the site with the stock block library
2. Export to Cursor           "Ozer Sites" export → prompt pack incl. ROUNDTRIP.md
3. Design + build in Cursor   component.tsx styled with --sb-* tokens
4. Map editable fields        block.manifest.json (what clients edit in Puck)
5. Land the pack in keel      src/workspaces/{accountSlug}/ + register
6. Finish in Site Studio      swap wireframe sections for custom blocks, publish
```

## Per-block contract (what Cursor produces)

Each block is a folder with two files:

```
src/workspaces/{accountSlug}/{block-name}/
├── component.tsx          React component ('use client')
└── block.manifest.json    editable-field manifest
```

### component.tsx

- `'use client'` at the top.
- Style with `--sb-*` CSS variables (`--sb-ink`, `--sb-surface`,
  `--sb-color-primary`, `--sb-space-*`, `--sb-radius-*`, …) — never
  hard-coded brand colours, so the block follows the site's design tokens.
- Use `SectionShell` / `CtaButton` / `MediaPlaceholder` from
  `@kit/site-blocks-core` where possible for consistent spacing.
- Every client-editable prop must have a matching entry in the manifest.
- Give new props defaults inside `render` so existing published pages keep
  working when fields are added later.

### block.manifest.json

```json
{
  "type": "YbbHero",
  "label": "YBB Hero",
  "category": "ybb",
  "fields": [
    { "key": "heading", "type": "text", "label": "Heading" },
    { "key": "body", "type": "textarea", "label": "Body" },
    { "key": "image", "type": "image", "label": "Image URL" },
    {
      "key": "items",
      "type": "array",
      "label": "Highlights",
      "itemLabel": "Highlight",
      "itemFields": [{ "key": "title", "type": "text", "label": "Title" }]
    }
  ],
  "defaults": { "heading": "…" }
}
```

Supported field types: `text`, `textarea`, `number`, `select` (with
`options`), `image` (v1: URL string), `link` (v1: href string), `array`
(with `itemFields`).

Naming: block `type` is PascalCase and workspace-prefixed (`YbbHero`,
`YbbProjectShowcase`) so it can never collide with core block types.

## Registering a pack

1. Copy `src/workspaces/_template/` to `src/workspaces/{accountSlug}/`.
2. In the pack `index.ts`, build components with
   `manifestToPuckConfig(manifest, Component)` and set `slug` to the
   workspace account slug.
3. Add the pack to `WORKSPACE_PACKS` in `src/registry.ts`.
4. Deploy `ozer` (editor) and `ozer-sites` (public renderer).

The editor and renderer both call `resolveSiteBlocksConfig(accountSlug)`:
core blocks plus the workspace pack when one is registered, core-only
otherwise.

## Changing a block later

- Update `component.tsx` / `block.manifest.json` in Cursor, then redeploy
  both apps.
- Prefer additive fields; give breaking props fallbacks in `render` until
  affected pages are republished.
- Pages published with stock block types keep working — swap sections to
  custom types in Puck whenever ready.
