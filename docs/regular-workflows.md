# Regular workflow commands

Quick reference for day-to-day workflows: pushing code, updating staging Supabase, and deploying on Vercel.

---

## 1. Push changes to GitHub

From the repo root (`keel/`):

```bash
cd /Users/danjamespotter/cursor/keel   # or your repo path
git status
git add .
git commit -m "Your message"
git push origin main
```


(Use your actual branch name if you work on `staging` or another branch.)

---

## 2. Update staging Supabase (migrations)

When you’ve added or changed migrations in `apps/web/supabase/migrations/` and want staging DB in sync:

```bash
cd keel/apps/web
supabase link --project-ref oteonnhmnqqfllesxnih
supabase db push
```

Enter the staging DB password when prompted (or set `SUPABASE_DB_PASSWORD` to avoid the prompt).

**Optional – regenerate TypeScript types** (after schema changes):

```bash
cd keel/apps/web
pnpm run supabase:typegen
```

Then commit the updated `packages/supabase/src/database.types.ts` and `apps/web/lib/database.types.ts` if they changed.

**One-liner with env vars** (if you use the deploy script):

```bash
cd keel/apps/web
SUPABASE_PROJECT_REF=oteonnhmnqqfllesxnih SUPABASE_DB_PASSWORD=your_password pnpm supabase:deploy
```

---

## 3. Redeploy on Vercel

**Automatic:** Pushing to the branch connected to your Vercel project (e.g. `main` or `staging`) triggers a new deployment. No extra command.

**Manual redeploy (same commit):**

1. Vercel Dashboard → your project → **Deployments**.
2. Open the **⋯** on the latest deployment → **Redeploy**.

Or via Vercel CLI (if installed):

```bash
vercel --prod
```

(Use without `--prod` for a preview deployment.)

---

## 4. Other commands you might use

| Task | Command |
|------|--------|
| Local dev | `pnpm dev` (from repo root) or `pnpm --filter web dev` |
| Reset local DB (reapply all migrations) | `pnpm supabase:web:reset` (from repo root) or from `apps/web`: `pnpm supabase:reset` |
| Apply migrations locally (no reset) | `cd apps/web && supabase db push` (with Supabase running) |
| Regenerate Supabase types (local) | `cd apps/web && pnpm run supabase:typegen` |
| Lint / typecheck | `pnpm lint` and `pnpm typecheck` (from repo root) |

---

## Typical “ship to staging” sequence

1. **Code:** `git add . && git commit -m "..." && git push origin main` (or your staging branch).
2. **DB:** If you changed migrations: `cd apps/web && supabase link --project-ref oteonnhmnqqfllesxnih && supabase db push`.
3. **Deploy:** Vercel deploys automatically on push; otherwise trigger a redeploy from the dashboard.
4. **Types (if schema changed):** `cd apps/web && pnpm run supabase:typegen`, then commit and push the type changes.

For full staging setup (env vars, Auth URLs, first-time Supabase/Vercel config), see [staging-deployment.md](./staging-deployment.md). For migration details, see [running-migrations.md](./running-migrations.md).
