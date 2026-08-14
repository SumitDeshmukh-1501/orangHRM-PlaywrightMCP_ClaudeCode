import { Locator, Page, Request } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * OrangeHRM login page.
 *
 * All locators below were confirmed live against the demo instance
 * (OrangeHRM OS 5.9) on 2026-08-14 via Playwright MCP.
 */
export class LoginPage extends BasePage {
  /** Login page path — relative, resolved against baseURL from .env. */
  static readonly path = '/web/index.php/auth/login';

  /** Internal form-submission endpoint, used only to prove it is NOT called. */
  static readonly validateEndpoint = '/web/index.php/auth/validate';

  readonly heading: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    super(page);
    // Confirmed live: heading "Login" [level=5].
    this.heading = page.getByRole('heading', { name: 'Login', level: 5 });
    this.usernameInput = page.getByRole('textbox', { name: 'Username', exact: true });
    this.passwordInput = page.getByRole('textbox', { name: 'Password', exact: true });
    this.loginButton = page.getByRole('button', { name: 'Login', exact: true });
    // Confirmed live: failed login renders a single role=alert whose entire
    // text content is exactly "Invalid credentials".
    this.errorAlert = page.getByRole('alert');
  }

  /** Opens the base URL, which redirects to the login page. */
  async openBaseUrl(): Promise<void> {
    await this.navigate('/');
  }

  /** Opens the login page directly. */
  async open(): Promise<void> {
    await this.navigate(LoginPage.path);
  }

  async fillUsername(username: string): Promise<void> {
    await this.usernameInput.fill(username);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.loginButton.click();
  }

  async login(username: string, password: string): Promise<void> {
    await this.fillUsername(username);
    await this.fillPassword(password);
    await this.submit();
  }

  /**
   * The inline validation message rendered beneath a single field.
   *
   * CSS last resort: the message is a plain <span> sibling inside the field's
   * `.oxd-input-group` wrapper, and that wrapper exposes no role, accessible
   * name, or test id — so nothing higher in the locator priority order can
   * scope to one field. The group is selected by class and then narrowed by
   * the labelled textbox it contains, which avoids a positional .nth().
   */
  validationMessageFor(field: 'Username' | 'Password'): Locator {
    const fieldInput = field === 'Username' ? this.usernameInput : this.passwordInput;
    return this.page
      .locator('.oxd-input-group')
      .filter({ has: fieldInput })
      .getByText('Required', { exact: true });
  }

  /**
   * Counts POSTs to the internal login-validate endpoint while `action` runs,
   * so a spec can prove client-side validation blocked the submission.
   * Returns a count only — the assertion stays in the spec.
   */
  async countValidateRequestsDuring(action: () => Promise<void>): Promise<number> {
    let count = 0;
    const listener = (request: Request) => {
      if (request.method() === 'POST' && request.url().includes(LoginPage.validateEndpoint)) {
        count += 1;
      }
    };
    this.page.on('request', listener);
    try {
      await action();
    } finally {
      this.page.off('request', listener);
    }
    return count;
  }
}
