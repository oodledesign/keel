# Jobs V1 – manual test checklist

Use this list to verify server actions and role enforcement for Jobs V1.

## Prerequisites

- At least two users: one **Owner/Admin** (or Staff) and one **Contractor** on the same account.
- Contractor must be **assigned to** some jobs (via job_assignments) for contractor tests.

---

## Jobs

### listJobs

- [ ] **Owner/Admin/Staff**: `listJobs({ accountId, tab: 'active', page: 1, pageSize: 20 })` returns jobs; `tab: 'completed'` returns only completed/cancelled.
- [ ] **Contractor**: Same call returns only jobs they are assigned to (active and completed tabs).
- [ ] **Query**: `query: 'something'` filters by title/description; `status` and `priority` filters work when provided.
- [ ] **Org**: Using another account’s `accountId` returns no rows (or only what RLS allows).

### getJob

- [ ] **Owner/Admin/Staff**: Can get any job in the account by `jobId` + `accountId`.
- [ ] **Contractor**: Can get a job only if assigned; otherwise no row / error.
- [ ] **Org**: Wrong `accountId` for the job yields not found / error.

### createJob

- [ ] **Owner/Admin/Staff**: `createJob({ accountId, title: 'Test', ... })` succeeds.
- [ ] **Contractor**: Same payload returns permission denied (no create).
- [ ] **Org**: `accountId` for another org returns permission denied.

### updateJob

- [ ] **Owner/Admin/Staff**: Can update all allowed fields (title, status, priority, dates, minutes, value, cost, client_id, etc.).
- [ ] **Contractor** (assigned to job): Can update only `status` and `actual_minutes`; other fields ignored or rejected at app layer.
- [ ] **Contractor** (not assigned): Update returns permission denied.
- [ ] **Org**: Wrong `accountId` / wrong job yields not found or permission denied.

### deleteJob

- [ ] **Owner**: `deleteJob({ accountId, jobId })` succeeds.
- [ ] **Admin**: Same, succeeds.
- [ ] **Staff**: Returns “Only account owners and admins can perform this action”.
- [ ] **Contractor**: Same as Staff (permission denied).
- [ ] **Org**: Deleting a job in another account fails (not found or denied).

---

## Assignments

### listJobAssignments

- [ ] **Owner/Admin/Staff**: Can list assignments for any job in the account.
- [ ] **Contractor**: Can list assignments only for jobs they can see (assigned jobs).
- [ ] **Org**: Wrong `accountId` or job from another account returns empty or error.

### addJobAssignment

- [ ] **Owner/Admin/Staff**: `addJobAssignment({ accountId, jobId, userId, role_on_job })` succeeds; duplicate (same job_id, user_id) fails with DB/unique error.
- [ ] **Contractor**: Returns permission denied.
- [ ] **Org**: `accountId` not matching the job’s org returns permission denied or error.

### removeJobAssignment

- [ ] **Owner/Admin/Staff**: `removeJobAssignment({ accountId, jobId, userId })` succeeds.
- [ ] **Contractor**: Returns permission denied.
- [ ] **Org**: Wrong account/job yields not found or denied.

---

## Notes

### listJobNotes

- [ ] **Owner/Admin/Staff**: Can list notes for any job in the account.
- [ ] **Contractor**: Can list notes only for jobs they are assigned to.
- [ ] **Org**: Wrong `accountId` or job returns empty or error.

### addJobNote

- [ ] **Owner/Admin/Staff**: `addJobNote({ accountId, jobId, note: 'Text' })` succeeds; note has correct `author_user_id`.
- [ ] **Contractor** (assigned): Same call succeeds.
- [ ] **Contractor** (not assigned): Returns “You can only add notes to jobs you are assigned to”.
- [ ] **Org**: Wrong `accountId` or job yields permission denied or error.

### deleteJobNote

- [ ] **Owner**: `deleteJobNote({ accountId, noteId })` succeeds.
- [ ] **Admin**: Same, succeeds.
- [ ] **Staff**: Returns “Only account owners and admins can perform this action”.
- [ ] **Contractor**: Same as Staff (permission denied).
- [ ] **Org**: Note from another account: not found or denied.

---

## Errors and validation

- [ ] **Zod**: Invalid UUIDs, missing required fields (e.g. `title` on create), or invalid enum values (status/priority) return validation errors from `enhanceAction`.
- [ ] **Not found**: `getJob` / get note with wrong id or wrong org returns a clear not-found or permission-denied style error.
- [ ] **Auth**: Unauthenticated requests to any action return authentication required (or redirect).

---

## Summary

| Action               | Owner/Admin | Staff | Contractor (assigned) | Contractor (not assigned) | Client |
|----------------------|-------------|-------|----------------------|----------------------------|--------|
| listJobs / getJob    | ✓           | ✓     | ✓ (assigned only)    | ✗                          | ✗      |
| createJob            | ✓           | ✓     | ✗                    | ✗                          | ✗      |
| updateJob            | ✓ full      | ✓ full| ✓ status, actual_mins| ✗                          | ✗      |
| deleteJob            | ✓           | ✗     | ✗                    | ✗                          | ✗      |
| list/add/remove assignments | ✓   | ✓     | ✗ (read-only list)   | ✗                          | ✗      |
| listJobNotes         | ✓           | ✓     | ✓ (assigned only)    | ✗                          | ✗      |
| addJobNote           | ✓           | ✓     | ✓ (assigned only)    | ✗                          | ✗      |
| deleteJobNote        | ✓           | ✗     | ✗                    | ✗                          | ✗      |

(Admin same as Owner for the above. Delete job and delete note are Owner/Admin only.)
