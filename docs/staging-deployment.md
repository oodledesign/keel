# Staging deployment (Vercel + Supabase)

This guide walks through deploying Keel to a **staging** environment: a separate Supabase project and a Vercel deployment (e.g. from a `staging` branch or Preview).

---

## 1. Supabase staging project

### 1.1 Create the project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New project**.
3. Choose your org, set **Name** (e.g. `keel-staging`), **Database password**, and **Region**.
4. Create the project and wait for it to be ready.

### 1.2 Get API keys and project ref

1. In the project, open **Project Settings** (gear) → **API**.
2. Note:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`) → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY`)
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)
3. In **Project Settings** → **General**, note **Reference ID** (e.g. `abcdefghij`) → used as `SUPABASE_PROJECT_REF` when linking.

Project URL: `https://YOUR_PROJECT_REF.supabase.co`
Publishable key: (anon key from API settings)
Service role key: (service_role key from API settings — keep secret)
Ref ID: (Reference ID from General settings)

### 1.3 Push migrations to staging

**Important:** These commands must be run from the app that contains your Supabase config and migrations. From the **workspace root** (e.g. `cursor/`), that means:

```bash
cd keel/apps/web
supabase link --project-ref YOUR_STAGING_PROJECT_REF
# Enter the database password when prompted (or set SUPABASE_DB_PASSWORD)

supabase db push
```

This applies all migrations in `keel/apps/web/supabase/migrations/` to the staging database (including the Contractor role, projects, clients, etc.).

If you run `supabase link` from the wrong directory (e.g. workspace root), the link is stored for that directory and `db push` will not see your migrations—or will report "up to date" while the staging DB stays empty. Always run both `supabase link` and `supabase db push` from `keel/apps/web`.

### 1.4 Configure Auth URLs for staging

After you have your **staging site URL** (from Vercel, e.g. `https://keel-staging.vercel.app` or `https://staging.yourdomain.com`):

1. In Supabase: **Authentication** → **URL Configuration**.
2. Set **Site URL** to your staging site URL (e.g. `https://keel-staging.vercel.app`).
3. Add **Redirect URLs** (one per line), for example:
   - `https://keel-staging.vercel.app/**`
   - `https://keel-staging.vercel.app/auth/callback`
   - `https://keel-staging.vercel.app/update-password`
   - `https://keel-staging.vercel.app/onboarding`
4. Save.

(Use your actual Vercel staging URL instead of `keel-staging.vercel.app`.)

---

## 2. Vercel staging deployment

### 2.1 Connect the repo (if not already)

1. Go to [Vercel](https://vercel.com) → **Add New** → **Project**.
2. Import your Git repository (GitHub/GitLab/Bitbucket).
3. Configure the project as below; do **not** add env vars yet if you prefer to do that after the first deploy.

### 2.2 Project / build settings (monorepo)

- **Framework Preset:** Next.js.
- **Root Directory:** `apps/web`  
  (so the app root is the Next.js app).
- **Build Command:** `pnpm run build` (runs in `apps/web` when Root Directory is set).
- **Install Command:** `pnpm install` (from repo root – Vercel usually runs from root then builds in Root Directory; if install fails, try leaving Install Command blank or `pnpm install --filter web...` – see note below).
- **Output Directory:** leave **empty** or default (Next.js uses `.next`). Do **not** set it to `public` or the build will fail with "No Output Directory named 'public' found".

**If Vercel runs install from repo root:** a typical setup is Root Directory = `apps/web`, and at repo root a custom **Install Command** such as `pnpm install` (so the whole monorepo is installed). Vercel will then run **Build Command** from `apps/web` with `pnpm run build`. If your lockfile is at the repo root, this works. If build fails with “module not found”, try Root Directory = `.` (repo root) and Build Command = `pnpm run build --filter=web` (or the turbo build that builds the web app).

### 2.3 Environment variables (staging)

In Vercel: **Project** → **Settings** → **Environment Variables**. Add these for **Preview** (or a custom **Staging** environment if you use one):

| Name | Value | Notes |
|------|--------|--------|
| `NEXT_PUBLIC_SITE_URL` | `https://your-staging-url.vercel.app` | Must match the URL Vercel gives this deployment (no trailing slash). |
| `NEXT_PUBLIC_SUPABASE_URL` | Staging project URL | From Supabase → Project Settings → API. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging anon key | Or use `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY` if your app expects that. |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging service_role key | Secret; server-only. |

Add any other env vars your app needs in production-like environments (e.g. from `.env.production` or turbo’s `globalEnv`), for example:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (staging Stripe key if you use billing in staging)
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (staging Stripe)
- `NEXT_PUBLIC_PRODUCT_NAME`, `NEXT_PUBLIC_SITE_TITLE`, etc. (can mirror production or use “Keel Staging”)
- Email/Mailer vars if you send mail from staging
- `RESEND_API_KEY` or similar if used

Apply these to **Preview** (and **Production** only when you deploy production from Vercel).

### 2.4 Staging URL and branch

- **Option A – Preview deployments:**  
  Deploy from a branch (e.g. `staging` or `main`). The deployment URL will be like `https://keel-xxx.vercel.app` or your custom domain. Use that URL in Supabase Auth (step 1.4) and in `NEXT_PUBLIC_SITE_URL` for that environment.

- **Option B – Fixed staging branch:**  
  1. Create a branch e.g. `staging`.  
  2. In Vercel → **Settings** → **Git**: set **Production Branch** to `main` (or your prod branch).  
  3. Deploy from `staging`; that deployment is a Preview. Use one stable Preview URL (e.g. assign a **custom domain** like `staging.yourdomain.com` to that branch’s deployments) and set that as `NEXT_PUBLIC_SITE_URL` and in Supabase Auth.

After the first deploy, copy the **deployment URL** into Supabase Auth (step 1.4) and into `NEXT_PUBLIC_SITE_URL` for that environment, then redeploy so the app and auth redirects match.

---

## 3. Checklist

- [ ] Supabase staging project created.
- [ ] Migrations pushed: `cd apps/web && supabase link --project-ref <ref> && supabase db push`.
- [ ] Staging site URL (from Vercel) set in Supabase **Authentication** → **URL Configuration** (Site URL + Redirect URLs).
- [ ] Vercel project connected to repo; Root Directory and Build Command set for the monorepo.
- [ ] Vercel env vars set for Preview (or Staging): `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, plus any other required vars.
- [ ] Deploy from `staging` (or your chosen branch); confirm build succeeds and the app loads.
- [ ] Test sign-in/sign-up and redirects (auth uses the URLs you configured in Supabase).

---

## 4. Optional: deploy script for Supabase

To avoid linking every time, you can use the project ref in a one-off or CI script:

```bash
cd apps/web
export SUPABASE_PROJECT_REF=your_staging_project_ref
export SUPABASE_DB_PASSWORD=your_db_password  # if you don’t want a prompt
pnpm supabase:deploy
```

(`supabase:deploy` runs `supabase link --project-ref $SUPABASE_PROJECT_REF && supabase db push`.)

---

## 5. Troubleshooting

- **Build fails (module not found / wrong root):** Adjust **Root Directory** and **Build Command** so that the app that uses `apps/web` is built with access to workspace packages (e.g. root = `apps/web` and install from repo root, or root = `.` and build with turbo filter).
- **Auth redirect / “redirect_uri” errors:** Ensure Supabase **Redirect URLs** include the exact staging origin and paths (e.g. `https://your-staging.vercel.app/**` and `https://your-staging.vercel.app/auth/callback`), and that `NEXT_PUBLIC_SITE_URL` matches that URL.
- **DB or RLS errors:** Confirm migrations were applied: in Supabase → **SQL Editor**, check that tables and roles exist (e.g. `roles` has `contractor`, `projects` and `clients` exist if you use them).



cd /Users/danjamespotter/cursor/keel
git remote add origin https://github.com/oodledesign/keel.git
git push -u origin main