import { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * OrangeHRM dashboard — the landing page after a successful login.
 *
 * Locators confirmed live on 2026-08-14 via Playwright MCP: the page's only
 * heading is "Dashboard" at level 6, inside the banner.
 */
export class DashboardPage extends BasePage {
  /** Dashboard path — relative, resolved against baseURL from .env. */
  static readonly path = '/web/index.php/dashboard/index';

  readonly heading: Locator;
  readonly sidePanel: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'Dashboard', level: 6 });
    this.sidePanel = page.getByRole('navigation', { name: 'Sidepanel' });
  }

  /** Navigates straight to the dashboard, whether or not a session exists. */
  async open(): Promise<void> {
    await this.navigate(DashboardPage.path);
  }
}
