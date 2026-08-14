# Feature: Login

## Description
A user should be able to log into the OrangeHRM system using valid
credentials and reach the Dashboard. Invalid credentials should be rejected
with a clear error message, and the user should remain on the login page.

## Type
ui

## Acceptance Criteria
- Entering a valid Username and Password and clicking Login navigates the
  user to the Dashboard.
- Entering an invalid Username/Password combination shows an error message
  and does not navigate away from the login page.
- Submitting the login form with Username or Password left blank shows a
  validation message and does not attempt to log in.

## Test Data / Constraints
- Valid credentials: `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env`
  (currently `Admin` / `admin123` on the demo instance).
- Invalid credentials should use a clearly bogus value (e.g. a random
  string), not a real-looking but wrong password, to avoid any ambiguity
  about intent.

## Priority Hint
critical

## Out of Scope
- Password reset / "Forgot your password?" flow — separate feature, not
  covered here.
- Remember-me / session persistence behavior — not part of core login
  correctness.
- Account lockout after repeated failed attempts — edge case, not
  confirmed to exist on this demo instance.
  - API-level login testing — OrangeHRM doesn't expose a documented REST
  "login" endpoint. Its public v2 API uses OAuth 2.0 (client_id/secret →
  bearer token), which is a different mechanism entirely from the web
  login form. The internal call the login page itself makes is
  undocumented, UI-only, and not a stable target for API testing. This
  feature is `type: ui` only — no `api` scenarios will be planned for it.

## Notes
This is everything I can reasonably assume without opening the live site —
none of this has been confirmed against the real page yet. Exact error
message text, exact field labels/placeholders, and the real post-login URL
are all unconfirmed. When you run this through the test-planner agent in
Claude Code, it should treat this file as the starting intent, then
explore the live login page via Playwright MCP to confirm or correct every
acceptance criterion above and fill in `observedNotes` with what's actually
true — don't treat this file as verified ground truth yet.