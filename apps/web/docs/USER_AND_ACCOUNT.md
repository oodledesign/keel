# User vs account

**User** = the logged-in person (you). Identified by auth (e.g. Supabase `user.id`). One user can belong to multiple accounts.

**Account** = a workspace/team (e.g. “Acme Ltd”, “Oodle”). Each account has its own clients, jobs, invoices, and members. The URL segment `[account]` is the account **slug** (e.g. `/home/oodle/clients`).

- **`/home/...` (no account in the path)** – Personal/default area: tasks, pipeline, settings, etc. Pipeline deals are owned by the user and linked to **businesses** (user-owned), not to a specific account.
- **`/home/[account]/...`** – Account-scoped area: clients, jobs, invoices, etc. Everything under here is scoped to that account (e.g. `account_id` in the DB).

When a pipeline deal is moved to **Won**, the app opens the **Add client** form in your first (default) **account** and prefills contact/company from the deal. You choose which account to use implicitly by which account you’re in when you use the pipeline; the “first” account is used for the redirect.
