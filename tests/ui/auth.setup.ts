
import { test as setup, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/dashboard.page';
import { LoginPage } from '../../pages/login.page';
import { adminCredentials } from '../../utils/env';

/**
 * Global authentication setup — runs ONCE per test run as the `setup` project,
 * which the `ui` project depends on.
 *
 * This exists so that no spec ever logs in through the UI in a `beforeEach`.
 * Every `ui` test starts already authenticated as Admin via the storageState
 * written here (playwright/.auth/admin.json, see playwright.config.ts).
 *
 * This file imports directly from @playwright/test rather than the logger
 * fixture: it is infrastructure, not a test, and it must not depend on the
 * per-test log-attachment behaviour of that fixture.
 *
 * The login page's locators are NOT duplicated here — LoginPage owns them.
 */

const ADMIN_STORAGE_STATE = 'playwright/.auth/admin.json';

setup('authenticate as Admin and save the shared storage state', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);
  const { username, password } = adminCredentials();

  await loginPage.open();
  await expect(loginPage.heading).toBeVisible();

  await loginPage.login(username, password);

  // Prove the session is genuinely authenticated BEFORE persisting it —
  // saving a failed-login state would make every dependent ui test fail with
  // a confusing redirect-to-login instead of a clear setup failure.
  await expect(page).toHaveURL(DashboardPage.path);
  await expect(dashboardPage.heading).toBeVisible();

  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
