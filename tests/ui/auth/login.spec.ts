import { expect, test } from '../../../fixtures/logger.fixture';
import { DashboardPage } from '../../../pages/dashboard.page';
import { LoginPage } from '../../../pages/login.page';
import { adminCredentials } from '../../../utils/env';
import { randomBogusPassword, randomBogusUsername } from '../../../utils/test-data';

/**
 * Login — UI scenarios from test-plans/login.plan.json.
 *
 * Login is the one feature that must NOT reuse the authenticated session: the
 * `ui` project sets storageState to playwright/.auth/admin.json, and every
 * scenario here requires an unauthenticated context. The override below is
 * the documented exception to the "never test the login flow inside the
 * authenticated project" rule — it replaces the shared session with an empty
 * one for this file only.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login (UI)', () => {
  test(
    'login-valid-credentials-dashboard — User with valid credentials logs in and reaches the Dashboard',
    { tag: ['@smoke', '@functional'] },
    async ({ page, log }, testInfo) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);
      const { username, password } = adminCredentials();

      log.step(testInfo.title, 'navigating to the base URL');
      await loginPage.openBaseUrl();
      await expect(page).toHaveURL(LoginPage.path);
      await expect(loginPage.heading).toBeVisible();

      log.step(testInfo.title, 'submitting valid credentials from .env');
      await loginPage.login(username, password);

      log.step(testInfo.title, 'expecting the Dashboard to load');
      await expect(page).toHaveURL(DashboardPage.path);
      await expect(dashboardPage.heading).toBeVisible();
      await expect(dashboardPage.heading).toHaveText('Dashboard');
    },
  );

  test(
    'login-invalid-credentials-error — Invalid credentials are rejected with "Invalid credentials" and the user stays on the login page',
    { tag: ['@smoke', '@functional', '@regression'] },
    async ({ page, log }, testInfo) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);
      const bogusUsername = randomBogusUsername();
      const bogusPassword = randomBogusPassword();

      log.step(testInfo.title, 'navigating to the base URL');
      await loginPage.openBaseUrl();

      log.step(testInfo.title, 'submitting bogus credentials', { username: bogusUsername });
      await loginPage.login(bogusUsername, bogusPassword);

      log.step(testInfo.title, 'expecting the "Invalid credentials" alert');
      // Confirmed live: the alert's entire text content is exactly this string.
      await expect(loginPage.errorAlert).toBeVisible();
      await expect(loginPage.errorAlert).toHaveText('Invalid credentials');

      log.step(testInfo.title, 'expecting to remain on the login page');
      await expect(page).toHaveURL(LoginPage.path);
      await expect(loginPage.heading).toBeVisible();
      await expect(dashboardPage.heading).toHaveCount(0);
    },
  );

  test(
    'login-required-field-validation — Submitting with Username and/or Password blank shows inline "Required" and no login is attempted',
    { tag: ['@functional', '@regression'] },
    async ({ page, log }, testInfo) => {
      const loginPage = new LoginPage(page);
      const { username } = adminCredentials();

      await loginPage.open();
      await expect(loginPage.heading).toBeVisible();

      await test.step('both fields blank', async () => {
        log.step(testInfo.title, 'clicking Login with both fields empty');
        // The request count is captured across submission AND the rendering of
        // the validation messages, so a late POST could not slip through.
        const validateCalls = await loginPage.countValidateRequestsDuring(async () => {
          await loginPage.submit();
          await expect(loginPage.validationMessageFor('Username')).toHaveText('Required');
          await expect(loginPage.validationMessageFor('Password')).toHaveText('Required');
        });

        log.step(testInfo.title, 'expecting no POST to the validate endpoint', { validateCalls });
        expect(
          validateCalls,
          'client-side validation must block the form submission',
        ).toBe(0);
        await expect(page).toHaveURL(LoginPage.path);
      });

      await test.step('username filled, password blank', async () => {
        log.step(testInfo.title, 'entering only a username, leaving Password blank');
        const validateCalls = await loginPage.countValidateRequestsDuring(async () => {
          await loginPage.fillUsername(username);
          await loginPage.submit();
          await expect(loginPage.validationMessageFor('Password')).toHaveText('Required');
        });

        log.step(testInfo.title, 'expecting "Required" under Password only', { validateCalls });
        await expect(loginPage.validationMessageFor('Username')).toHaveCount(0);
        expect(
          validateCalls,
          'client-side validation must block the form submission',
        ).toBe(0);
        await expect(page).toHaveURL(LoginPage.path);
      });
    },
  );

  test(
    'login-unauthenticated-page-guard — Unauthenticated access to a protected page redirects to the login page',
    { tag: ['@functional', '@integration', '@regression'] },
    async ({ page, log }, testInfo) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      log.step(testInfo.title, 'navigating directly to the dashboard without logging in');
      await dashboardPage.open();

      log.step(testInfo.title, 'expecting a redirect to the login page');
      await expect(page).toHaveURL(LoginPage.path);
      await expect(loginPage.heading).toBeVisible();

      log.step(testInfo.title, 'expecting no Dashboard content to render');
      await expect(dashboardPage.heading).toHaveCount(0);
      await expect(dashboardPage.sidePanel).toHaveCount(0);
    },
  );
});
