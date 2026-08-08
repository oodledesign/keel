# Ozer Docs

Product documentation for Ozer, built with [Nextra 4](https://nextra.site/) (same stack as the [Vercel documentation starter kit](https://vercel.com/templates/next.js/documentation-starter-kit)).

## Local development

```bash
# from repo root
pnpm --filter docs dev
# → http://localhost:3012
```

Or with the root alias:

```bash
pnpm docs:dev
```

## Content

MDX lives in [`content/`](./content). Sidebar order is controlled by `_meta.ts` files.

## Deploy

1. Create a Vercel project with **Root Directory** `apps/docs` (this package’s [`vercel.json`](./vercel.json) runs the monorepo install/build).
2. Attach the domain **`docs.ozer.so`**.
3. On the marketing/`web` project, set `NEXT_PUBLIC_DOCS_URL=https://docs.ozer.so` so `/docs` redirects and in-app links point here.

Local default for that env var is `http://localhost:3012`.

## Notes

- Nextra requires **Zod 4**; the monorepo keeps Zod 3 for the rest of the workspace and scopes Zod 4 to this app / nextra via pnpm overrides.
- `nextra-theme-docs@4.6.1` ships a React Compiler bug that strips `children` before Layout prop validation. Fixed via [`patches/nextra-theme-docs@4.6.1.patch`](../../patches/nextra-theme-docs@4.6.1.patch).
