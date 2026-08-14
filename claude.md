# Project: OrangeHRM Test Automation

## Overview
End-to-end test automation project targeting the OrangeHRM demo site
(https://opensource-demo.orangehrmlive.com/) for practice/learning purposes.
Test creation is AI-assisted via a three-agent pipeline (see below).

## Tech Stack
- **Language:** TypeScript
- **Framework:** Playwright Test (@playwright/test) — used for both UI and
  API testing (via Playwright's `request` fixture for API, no browser needed)
- **Tool access:** Playwright MCP (use this for exploring the live DOM,
  inspecting selectors, and verifying locators before writing UI test code —
  don't guess at selectors, check them against the real page)
- **Editor:** VS Code
- **Target app:** OrangeHRM demo — https://opensource-demo.orangehrmlive.com/
  - Default login: Username `Admin`, Password `admin123`
  - This is a public demo instance and may reset periodically — don't assume
    seeded data persists across runs. Generate fresh data at runtime.
  - No direct database access to this instance — DB-level testing is out of
    scope for this project.

## Environment Configuration
- All environment-specific values (base URL, credentials, API base URL) live
  in `.env`, loaded via `dotenv` in `playwright.config.ts`. Never hardcode
  these in specs, page objects, or config files directly.
- `.env` is gitignored — real values, local only.
- `.env.example` is committed — documents required variables with placeholder
  values, so anyone cloning the repo knows what to set up:

  BASE_URL=https://opensource-demo.orangehrmlive.com
ADMIN_USERNAME=Admin
ADMIN_PASSWORD=admin123
API_BASE_URL=https://opensource-demo.orangehrmlive.com/web/index.php/api

- Even though this project's "secrets" are public demo credentials, follow
  the pattern strictly — if this suite is ever pointed at a real instance,
  the credential handling should already be correct.

## Agent Pipeline
This project is driven by three Claude Code subagents defined in
`.claude/agents/`. Invoke them in order:

1. **test-planner** — give it a plain-English requirement. It reads this
   file and produces `test-plans/<feature>.plan.json` (scenarios, steps,
   expected results, test data, **type**, **scope tags**). It does not
   write code.
2. **test-generator** — give it a confirmed plan. For UI scenarios, it uses
   Playwright MCP to verify real locators on the live site and writes/updates
   page objects in `pages/`. For API scenarios, it inspects the actual
   request/response via Playwright MCP or direct calls before writing
   assertions. It writes specs to the correct `tests/<type>/<module>/`
   folder with correct tags, then runs the tests.
3. **test-healer** — invoked automatically (or manually) when
   test-generator reports failures. It reads the plan (intent), the failing
   spec, `reports/results.json`, the structured log, the trace, and the
   screenshot, diagnoses the failure category, and applies a minimal fix.
   Capped at 3 attempts per test before escalating to you.

Each agent's full contract (inputs, outputs, rules) lives in its own file —
read `.claude/agents/test-planner.md`, `test-generator.md`, `test-healer.md`
for the exact spec. Keep this section and those files in sync if you change
the pipeline.

## Test Classification: Type (folders) vs. Scope (tags)
Two independent ways to slice the suite — don't conflate them.

- **Type = which layer** — determines folder and Playwright *project*
  (different fixtures, different runtime needs). A test lives in exactly one
  type folder:
  - `ui` — browser-based, uses page objects
  - `api` — Playwright `request` fixture, no browser
- **Scope = which testing category** — determines *tag(s)*, cuts across type
  and feature. A test can carry **one or more** scope tags:
  - `@smoke` — minimal critical-path check
  - `@sanity` — quick check after a small change/fix
  - `@functional` — verifies a specific feature's behavior in isolation
  - `@integration` — verifies interaction between modules/components
  - `@e2e` — full user journey across multiple screens/steps
  - `@regression` — broader safety-net coverage, run before releases

  A smoke test is often also functional, so multiple tags on one test are
  expected, not a mistake:

```ts
  test('add employee — happy path', { tag: ['@smoke', '@functional'] }, async ({ page }) => {
    ...
  });
```

Note: `tests/ui/auth/` and `tests/api/auth/` (same pattern for `pim/`,
`leave/`) are **not duplicates** — they test the same feature at different
layers. `ui/auth/` checks the login page/form; `api/auth/` checks the login
endpoint's request/response directly. Same logic applies to any module that
has both a UI and an API surface.

## Folder Structure

├── .claude/
│ └── agents/ # test-planner.md, test-generator.md, test-healer.md
├── tests/
│ ├── ui/
│ │ ├── auth/ # login page UI checks
│ │ ├── pim/ # Personnel Information Management
│ │ ├── leave/
│ │ └── admin/
│ └── api/
│ ├── auth/ # login endpoint checks
│ ├── pim/
│ └── leave/
├── pages/ # Page Object Model classes (UI only)
│ ├── base.page.ts
│ ├── login.page.ts
│ └── ...
├── api-clients/ # thin wrappers per API resource (API only)
│ └── ...
├── fixtures/
│ └── logger.fixture.ts # custom test fixture: structured logging + log attachment on failure
├── utils/
│ ├── logger.ts # structured (JSON-lines) logger, one file per run
│ └── test-data.ts # runtime test data generation (no hardcoded values)
├── test-plans/ # test-planner output — one *.plan.json per feature
├── test-artifacts/ # gitignored — screenshots, videos, traces, logs (runtime-generated)
├── reports/ # gitignored — HTML/JSON/JUnit reports (runtime-generated)
├── .github/
│ └── workflows/
│ └── playwright.yml
├── playwright.config.ts
├── package.json
├── .env # gitignored — real values, local only
├── .env.example # committed — documents required vars, no real secrets
├── .gitignore
└── CLAUDE.md


## Reporting & Diagnostics (enterprise-style)
Configured in `playwright.config.ts` — don't bypass these:
- **Screenshots:** `only-on-failure`, saved under `test-artifacts/`
- **Video:** `retain-on-failure` (UI project only — irrelevant for API)
- **Trace:** `retain-on-failure` — inspect with `npx playwright show-trace <path>`
- **Reports:** HTML (`reports/html`), JSON (`reports/results.json`), JUnit
  (`reports/junit.xml` — for CI dashboards)
- **Structured logs:** every test run appends JSON-lines to
  `test-artifacts/logs/run-<timestamp>.log` via the `logger.fixture.ts`
  fixture. Every spec must import `test`/`expect` from
  `../../fixtures/logger.fixture`, not `@playwright/test` directly. On
  failure, the relevant log lines are attached to the HTML report.

The test-healer agent is expected to read all of the above before making any
fix — never guess at a failure cause without checking the log/trace/screenshot first.

## Conventions
- **Page Object Model (POM):** every UI page/section gets its own class in
  `pages/`. UI tests should not contain raw locators — they call methods on
  page objects.
- **API clients:** every API resource gets a thin wrapper class/module in
  `api-clients/` (e.g. `employeeApi.ts`). API tests call these, not raw
  `request.get/post` calls inline, for the same reason UI tests use POM.
- **Locators:** prefer `getByRole`, `getByLabel`, `getByTestId` over CSS/XPath
  selectors. Use Playwright MCP to confirm the actual accessible name/role
  before writing a locator.
- **Naming:** `feature.spec.ts` for test files, `feature.page.ts` for page
  objects, `feature.api.ts` for API clients, PascalCase for classes,
  camelCase for variables/functions.
- **Test independence:** each test should be able to run in isolation. Use
  `beforeEach` for login/navigation setup, or a storageState fixture for
  authenticated sessions instead of logging in via UI every test.
- **Assertions:** use Playwright's built-in `expect` with auto-retrying
  matchers (`toBeVisible`, `toHaveText`, etc.) — avoid manual waits/sleeps.
- **No hardcoded waits:** never use `page.waitForTimeout()` as a fix for
  flakiness; find the correct auto-waiting condition instead.
- **No hardcoded test data:** generate fresh values at runtime (see
  `utils/test-data.ts`) since this is a shared demo instance.
- **No hardcoded environment values:** base URLs and credentials come from
  `.env`, never inline in specs, page objects, or config.
- **Tags:** every test declares one type (folder) and one or more scope tags
  — see "Test Classification" above.

## Commands
- Run all tests: `npx playwright test`
- Run by type: `npm run test:ui` / `npm run test:api`
- Run by scope: `npm run test:smoke` / `test:sanity` / `test:functional` /
  `test:e2e` / `test:integration` / `test:regression`
- Run by type + scope: `npm run test:ui:smoke` / `test:api:smoke`
- Run a single file: `npx playwright test tests/ui/pim/add-employee.spec.ts`
- Run headed (debugging): `npx playwright test --project=ui --headed`
- Open last HTML report: `npx playwright show-report reports/html`
- Show trace for a specific failure: `npx playwright show-trace test-artifacts/<path-to-trace.zip>`
- Codegen against the live site (for locator discovery, not final code):
  `npx playwright codegen https://opensource-demo.orangehrmlive.com/`

## Version Control
- **Branching:** one branch per feature/fix, matching the plan's feature
  name, e.g. `test/add-employee`, `fix/leave-request-flaky-date-picker`.
- **Commit messages:** prefix with the origin so history stays traceable
  back to a plan/scenario:
  - `test: <feature> — generated` (test-generator's initial commit)
  - `fix: <feature> — healed <scenario-id>` (test-healer's fix)
  - `plan: <feature> — added/updated` (test-planner's plan file)
- **Never commit:** `test-artifacts/`, `reports/`, `node_modules/`, `.env` —
  all gitignored.
- **What IS committed:** `test-plans/*.json`, `tests/`, `pages/`,
  `api-clients/`, `fixtures/`, `utils/`, config files, `.env.example`,
  `.claude/agents/`. Plans are versioned like code — they're the spec of
  intent, and diffing them over time shows how requirements evolved.
- Agents should stage and describe their own changes when asked to commit,
  but should not push or force-push without explicit confirmation.

## CI/CD
- GitHub Actions workflow at `.github/workflows/playwright.yml` runs the
  full suite (both `ui` and `api` projects) on every push and pull request.
- CI runs tests only — it does **not** invoke test-healer. Healing is a
  local, human-supervised loop; CI exists to catch regressions the agents
  didn't (or a manual code change broke). A red CI run means a human (or a
  manually-invoked healer session) investigates, not an automated fix loop
  running unattended in a pipeline.
- On failure, CI uploads the HTML report, traces, screenshots, and the
  structured log as build artifacts — download these from the failed run
  rather than re-running locally blind.
- `playwright.config.ts` branches on `process.env.CI` for `retries` and
  `workers` — CI gets 2 retries and constrained parallelism for stability;
  local runs default to fewer retries and full parallelism for speed.

## Working Style for Claude Code
- Use the three-agent pipeline in order: test-planner → test-generator →
  test-healer. Don't skip straight to writing spec files by hand in normal
  chat — that bypasses the plan trail that makes failures diagnosable later.
- When adding a new UI test, the generator must use Playwright MCP to
  inspect the relevant page and confirm locators before writing code. For
  API tests, it must verify actual request/response shape before writing
  assertions.
- Keep page objects/API clients and tests in sync — if a locator or endpoint
  changes, update it in the page object/client, not inline in the test.
- After writing or editing tests, run them and report pass/fail results
  rather than assuming they pass.
- Ask before adding new dependencies or restructuring folders.
- Favor small, focused PRs/commits: one feature or fix per change.