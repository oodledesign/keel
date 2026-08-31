# Skip unrelated Vercel builds

The keel repo is one GitHub remote attached to three Vercel projects:

| Vercel project | Root Directory | App |
|----------------|----------------|-----|
| **ozer** | `apps/web` | SaaS / marketing |
| **ozer-docs** | `apps/docs` | Product docs |
| **ozer-sites** | `apps/sites` | Public site renderer |

Without an ignore command, every push (PR commit **and** `main`) queues a build for all three. Each app’s `vercel.json` now sets `ignoreCommand` so Vercel only builds the project(s) whose tree actually changed.

**Exit codes** (Vercel): `0` = skip this build, `1` = proceed.

This does **not** cancel builds that are already queued. Only new deployments after this lands will be filtered.

## What triggers a build

| Project | Build when the diff includes | Skip when |
|---------|------------------------------|-----------|
| **ozer** | `apps/web`, `packages/`, `pnpm-lock.yaml`, root workspace config (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`), or anything else outside docs/sites/ios | Diff is **only** `apps/docs`, `apps/sites`, and/or `apps/ios` |
| **ozer-docs** | `apps/docs`, `tooling/typescript`, `patches/`, lockfile, or root workspace config | Only web / sites / ios / other unrelated paths |
| **ozer-sites** | `apps/sites`, `packages/site-blocks-core`, `packages/site-blocks-workspaces`, `tooling/typescript`, `patches/`, lockfile, or root workspace config | Only web / docs / ios / other unrelated paths |

`apps/ios` is a native Xcode/SwiftUI project. It is excluded from the pnpm workspace (`!apps/ios`) so `pnpm` and Turbo never compile Swift. An iOS-only commit must not enqueue **ozer**, **ozer-docs**, or **ozer-sites**.

If `git diff` fails (first commit, missing `HEAD^`, shallow clone), the script **proceeds** rather than skip. Production `main` deploys of **ozer** also proceed if the script cannot be sure it is safe to skip.

## `vercel.json` (preferred)

Vercel honors `ignoreCommand` from each app’s `vercel.json` (Root Directory) and that value overrides the dashboard Ignored Build Step:

- `apps/web/vercel.json` → `bash ../../scripts/vercel-ignore.sh web`
- `apps/docs/vercel.json` → `bash ../../scripts/vercel-ignore.sh docs`
- `apps/sites/vercel.json` → `bash ../../scripts/vercel-ignore.sh sites`

The command runs from the project Root Directory, which is why the path is `../../scripts/...`.

## Dashboard fallback

Only needed if a project does not pick up `ignoreCommand` from `vercel.json`.

1. Vercel → project → **Settings → Git → Ignored Build Step**.
2. Choose **Custom** and paste the matching one-liner:

```bash
# ozer
bash ../../scripts/vercel-ignore.sh web

# ozer-docs
bash ../../scripts/vercel-ignore.sh docs

# ozer-sites
bash ../../scripts/vercel-ignore.sh sites
```

3. Ensure **Automatically Expose System Environment Variables** is on so `VERCEL_ENV` / `VERCEL_GIT_COMMIT_REF` are available.

Do not disconnect Git integration. Redeploys and deploy hooks still work.

## Local check

```bash
# skip web (docs-only change)
VERCEL_IGNORE_FILES=$'apps/docs/content/index.mdx' bash scripts/vercel-ignore.sh web; echo $?

# proceed web (package change)
VERCEL_IGNORE_FILES=$'packages/ui/src/button.tsx' bash scripts/vercel-ignore.sh web; echo $?

# skip docs (web-only change)
VERCEL_IGNORE_FILES=$'apps/web/app/page.tsx' bash scripts/vercel-ignore.sh docs; echo $?

# skip web / docs / sites (Swift-only change)
VERCEL_IGNORE_FILES=$'apps/ios/README.md' bash scripts/vercel-ignore.sh web; echo $?
VERCEL_IGNORE_FILES=$'apps/ios/Ozer/OzerApp.swift' bash scripts/vercel-ignore.sh docs; echo $?
VERCEL_IGNORE_FILES=$'apps/ios/Ozer/OzerApp.swift' bash scripts/vercel-ignore.sh sites; echo $?
```
