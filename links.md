Supabase Studio: localhost:54323
Mailpit: localhost:54324



When starting a session:

1. Open Docker

2. Start Supabase (from web app): cd /Users/danjamespotter/projects/keel/apps/web && supabase start

3. Run server (port 3000):
   ```bash
   cd /Users/danjamespotter/projects/keel
   pnpm dev
   ```


cd /Users/danjamespotter/projects/keel/apps/web
   supabase status --output json

If port 3000 is in use or you get "Unable to acquire lock":
- Kill process on 3000: `lsof -ti:3000 | xargs kill -9`
- Remove dev lock: `rm -f /Users/danjamespotter/cursor/keel/apps/web/.next/dev/lock`
- Then run `pnpm dev` again

pnpm install (from monorepo root): `cd /Users/danjamespotter/cursor/keel && pnpm install --no-frozen-lockfile`

Apply migrations to **local** Supabase (run from web app; resets DB and applies all migrations):
```bash
cd /Users/danjamespotter/cursor/keel/apps/web
supabase db reset
```

Push migrations to **remote**:
```bash
cd /Users/danjamespotter/cursor/keel/apps/web
supabase db push
```

Prune Docker:
docker system prune -a --volumes

Push to staging:
git push origin main
git push origin staging

