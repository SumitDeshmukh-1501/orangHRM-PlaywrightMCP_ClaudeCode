# Feature: System Users (Admin > User Management > Users)

## Description

An Admin should be able to view, search/filter, add, and delete system
users from the Admin > User Management > Users page
(https://opensource-demo.orangehrmlive.com/web/index.php/admin/viewSystemUsers).
This page controls login accounts for the system (distinct from employee
records in PIM) — each system user is typically linked to an employee and
has a role (Admin/ESS) and a status (Enabled/Disabled).

## Type

ui

## Acceptance Criteria

- The Users list loads and displays existing system users with their
  Username, User Role, Employee Name, and Status.
- Searching/filtering by Username returns only matching results.
- Filtering by a User Role or Status that has no matching records shows an
  appropriate "no records found" state, not an error.
- Admin can add a new system user with the required fields and the new
  user appears in the list afterward.
- Admin can delete an existing system user, and it no longer appears in the
  list afterward.

## Test Data / Constraints

- New usernames must be unique per run — generate fresh values at runtime
  (see `utils/test-data.ts`), never hardcode a username, since this is a
  shared demo instance and a collision would cause a false failure.
- Deleting a user during a test should target only data created by that
  test — never delete a pre-existing/seeded user on the shared instance.
- Adding a system user likely requires linking to an existing employee
  record — if no suitable employee exists, this may need a data
  precondition via `utils/setup-data.ts` (create an employee first via
  API), similar to the pattern used for other PIM-dependent features.

## Priority Hint

critical — for view/search and add; major — for delete (high-impact but
secondary to core create/view flow)

## Out of Scope

- API-level testing for this feature — same OAuth client registration
  prerequisite documented in `claude.md`; no `api`-type scenarios until
  that's set up. This feature is `type: ui` only for now.
- Editing an existing user's role/status — not covered in this round;
  only add/search/delete.
- Password reset or credential-related behavior for system users.
- Bulk delete (multi-select) — only single-record delete is in scope
  unless observed to be trivial to also cover live.

## Notes

This is a rough intent draft — none of this has been confirmed against the
live page yet. Exact field labels (e.g. whether it's "Employee Name" or
something else), the exact required fields on the Add User form, the exact
"no records" message text, and whether delete requires a confirmation
dialog are all unconfirmed. When run through test-planner, it should
explore this page live via Playwright MCP (logged in as Admin), confirm or
correct every acceptance criterion above, and fill in `observedNotes` with
what's actually true before any plan is finalized.
