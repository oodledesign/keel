# Keel – Permission matrix (account roles)

Copy-paste friendly. **Account roles** are assigned per team; permissions are enforced in the app and via RLS.

---

## Role hierarchy (highest → lowest)

| Level | Role       | Description |
|-------|------------|-------------|
| 100   | **Owner**  | Primary owner of the team; full control. |
| 80    | **Admin**  | Same as owner except cannot manage roles. |
| 50    | **Staff**  | Day-to-day use: settings, invites, projects, clients. |
| 30    | **Contractor** | Limited: assigned projects only; clients read-only from those projects. |
| 10    | **Client** | Minimal: settings, view projects. |

---

## Permission matrix

| Permission        | Owner | Admin | Staff | Contractor | Client |
|-------------------|:-----:|:-----:|:-----:|:----------:|:------:|
| **roles.manage**  | ✅    | ❌    | ❌    | ❌         | ❌     |
| **billing.manage**| ✅    | ✅    | ❌    | ❌         | ❌     |
| **settings.manage** | ✅  | ✅    | ✅    | ❌         | ✅     |
| **members.manage**| ✅    | ✅    | ❌    | ❌         | ❌     |
| **invites.manage**| ✅    | ✅    | ✅    | ❌         | ❌     |
| **projects.view** | ✅    | ✅    | ✅    | ✅*        | ✅     |
| **projects.edit** | ✅    | ✅    | ✅    | ✅*        | ❌     |
| **clients.view**  | ✅†   | ✅†   | ✅†   | ✅*        | ❌     |
| **clients.edit**  | ✅    | ✅    | ✅    | ❌         | ❌     |

\* **Contractor:** RLS limits access to **assigned projects** only. Contractors **cannot create** projects (no INSERT on projects). Clients: read-only and only for clients linked to projects they are assigned to.  
† Owner, Admin, Staff have **clients.edit**; they can also view clients (e.g. via UI that uses the same RLS as clients.view where applicable).

---

## Contractor scoping (RLS)

- **Projects:** Can SELECT, UPDATE, DELETE only on projects they are assigned to (via `project_assignments`). Cannot INSERT (create) projects.
- **Clients:** Can SELECT only. Rows visible only when the client’s `project_id` is set and the contractor is assigned to that project. Cannot INSERT, UPDATE, or DELETE clients.
- **Project assignments:** Can only view assignments for projects they can see. Only users with **projects.edit** and who are **not** contractors can add/remove assignments.

---

## Invite / member role options

When adding members in **Org settings → Members**, the role dropdown shows only **product roles**: Owner, Admin, Staff, Contractor, Client. Any other role in the database (e.g. **custom-role** from the dev seed) is hidden so it does not appear as an option. **Contractor** is a full account role: invite someone as Contractor to give them access only to projects they are assigned to and read-only access to clients on those projects.

## Company roles (onboarding persona)

Used for onboarding flow and UI only (e.g. which steps to show). Stored as `company_role` on `accounts_memberships` / invitations. Not the same as account permissions above.

| Company role     | Typical account role | Notes |
|------------------|----------------------|--------|
| **admin**        | owner                | Creates team; sees full onboarding. |
| **staff_member** | staff                | Invited; trade role, personal details, accessibility. |
| **contractor**   | contractor           | Invited; same steps as staff, then assigned to projects. |
| **client**       | client               | Invited; personal details, accessibility only. |

---

## Summary table (permissions only)

| Permission        | Owner | Admin | Staff | Contractor | Client |
|-------------------|:-----:|:-----:|:-----:|:----------:|:------:|
| roles.manage      | ✅    | ❌    | ❌    | ❌         | ❌     |
| billing.manage    | ✅    | ✅    | ❌    | ❌         | ❌     |
| settings.manage   | ✅    | ✅    | ✅    | ❌         | ✅     |
| members.manage    | ✅    | ✅    | ❌    | ❌         | ❌     |
| invites.manage    | ✅    | ✅    | ✅    | ❌         | ❌     |
| projects.view     | ✅    | ✅    | ✅    | ✅*        | ✅     |
| projects.edit     | ✅    | ✅    | ✅    | ✅*        | ❌     |
| clients.view      | ✅    | ✅    | ✅    | ✅*        | ❌     |
| clients.edit      | ✅    | ✅    | ✅    | ❌         | ❌     |

\* Contractor: scoped to assigned projects only; projects.edit does not allow creating projects.
