# Keel Role Permission Matrix

Source extracted from `Keel - Dev Plan.docx`.

## Role Hierarchy

| Level | Role | Description |
| --- | --- | --- |
| 100 | Owner | Primary owner of the team. Full control. |
| 80 | Admin | Same as Owner except cannot manage roles. |
| 50 | Staff | Day-to-day operations: projects, clients, invites. |
| 30 | Contractor | Limited to assigned projects only. Clients read-only via assigned projects. |
| 10 | Client | Minimal access. View assigned projects and manage own settings. |

## Core Permission Matrix

| Permission | Owner | Admin | Staff | Contractor | Client |
| --- | --- | --- | --- | --- | --- |
| `roles.manage` | Yes | No | No | No | No |
| `billing.manage` | Yes | Yes | No | No | No |
| `settings.manage` | Yes | Yes | Yes | No | Yes |
| `members.manage` | Yes | Yes | No | No | No |
| `invites.manage` | Yes | Yes | Yes | No | No |
| `projects.view` | Yes | Yes | Yes | Yes* | Yes |
| `projects.edit` | Yes | Yes | Yes | Yes* | No |
| `clients.view` | Yes | Yes | Yes | Yes* | No |
| `clients.edit` | Yes | Yes | Yes | No | No |

\* Contractor access is limited via RLS.

## Contractor Access Scope

| Resource | Access Level | Conditions |
| --- | --- | --- |
| Projects | Select, Update, Delete | Only if assigned via `project_assignments`. Cannot create. |
| Clients | Select only | Only clients linked to assigned projects. No insert/update/delete. |
| Project Assignments | Select only | Only assignments related to visible projects. |
| Add/Remove Assignments | Not allowed | Only non-contractors with `projects.edit` may manage assignments. |

## Contractor UI Scope

### Client detail view

- Allowed: client image, display name, organisation name, address, email, phone number, notes
- Hidden: total projects, total value, activity summary, portal invitation status, invite action, edit action, delete action
- Notes are read-only for contractors

### Job list view

- Allowed: title, client, status, priority, due date, assigned count
- Hidden: value column

### Job detail view

- Allowed:
  - title
  - status
  - priority
  - due date
  - notes
  - `Overview`
  - `Schedule`
  - `Team`
  - `Messages`
  - `Visits & Meetings`
- Hidden:
  - finance/value summary
  - `Finance` tab
  - `Docs` tab
- Edit controls remain unavailable unless the contractor has an assigned-row action allowed by the feature flow

## Company Roles

These are onboarding and UI personas only, not permission roles.

| Company Role | Typical Account Role | Notes |
| --- | --- | --- |
| `admin` | Owner | Creates team. Full onboarding flow. |
| `staff_member` | Staff | Invited. Completes trade, personal details, accessibility. |
| `contractor` | Contractor | Invited. Same onboarding as staff. Later assigned to projects. |
| `client` | Client | Invited. Personal details + accessibility only. |
