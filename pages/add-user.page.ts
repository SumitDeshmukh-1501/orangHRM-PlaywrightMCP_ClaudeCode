import { Locator, Page } from '@playwright/test';
import { SystemUsersPage } from './system-users.page';

/** The six required fields on the Add User form, by their label text. */
export type AddUserField =
  | 'User Role'
  | 'Employee Name'
  | 'Status'
  | 'Username'
  | 'Password'
  | 'Confirm Password';

/**
 * Admin > User Management > System Users > Add User.
 *
 * Extends SystemUsersPage to reuse the confirmed `inputGroupFor` /
 * `selectFromDropdown` mechanics — the two pages render the same OrangeHRM
 * input-group and custom-dropdown widgets, so duplicating those locators here
 * would mean two places to fix when the app changes.
 *
 * All locators confirmed live on 2026-08-14 via Playwright MCP.
 */
export class AddUserPage extends SystemUsersPage {
  /** Form path — relative, resolved against baseURL from .env. */
  static readonly formPath = '/web/index.php/admin/saveSystemUser';

  /**
   * The async uniqueness check behind the Username field. Confirmed live:
   * GET .../api/v2/admin/validation/user-name?userName=... => 200, fired on
   * input/blur. Used as a sync point so Save is never raced against a
   * still-pending validation call.
   */
  private static readonly usernameValidationEndpoint =
    '/api/v2/admin/validation/user-name';

  /**
   * The Employee Name autocomplete's lookup. Confirmed live:
   * GET .../api/v2/pim/employees?nameOrId=a => 200.
   */
  private static readonly employeeLookupEndpoint = '/api/v2/pim/employees';

  readonly formHeading: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly employeeNameInput: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly requiredLegend: Locator;

  constructor(page: Page) {
    super(page);

    this.formHeading = page.getByRole('heading', { name: 'Add User', level: 6 });

    // CSS last resort for all three: confirmed live that these inputs have no
    // accessible name, no placeholder and no `for`-associated label, so
    // getByRole('textbox', { name }) does not resolve. Scoped by the input
    // group whose label matches EXACTLY — `:text-is()` is what stops the
    // "Password" group from also matching "Confirm Password".
    this.usernameInput = this.inputGroupFor('Username').locator('input');
    this.passwordInput = this.inputGroupFor('Password').locator('input');
    this.confirmPasswordInput = this.inputGroupFor('Confirm Password').locator('input');

    // This one has a placeholder, so it uses the preferred strategy.
    this.employeeNameInput = page.getByPlaceholder('Type for hints...');

    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
    this.requiredLegend = page.getByText('* Required', { exact: true });
  }

  /** Navigates straight to the Add User form. */
  async open(): Promise<void> {
    await this.page.goto(AddUserPage.formPath);
  }

  /** The label element for one of the six required fields. */
  labelFor(field: AddUserField): Locator {
    return this.inputGroupFor(field).locator('label');
  }

  /**
   * The inline validation message rendered beneath one field.
   *
   * CSS last resort: the message is a bare <span> inside the field's input
   * group with no role and no accessible name. Returned as a locator (not a
   * string) so the spec can use an auto-retrying assertion — essential for
   * Username, whose "Already exists" check is asynchronous.
   */
  validationMessageFor(field: AddUserField): Locator {
    return this.inputGroupFor(field).locator('.oxd-input-field-error-message');
  }

  async selectUserRole(role: string): Promise<void> {
    await this.selectFromDropdown('User Role', role);
  }

  async selectStatus(status: string): Promise<void> {
    await this.selectFromDropdown('Status', status);
  }

  /**
   * Types `hintChar` into the Employee Name autocomplete, picks the FIRST
   * suggestion, and returns that suggestion's visible text.
   *
   * This is how the test satisfies its "an employee must already exist"
   * precondition without any API setup helper: an existing employee is
   * discovered at runtime rather than hardcoded, which is required on a shared
   * demo instance whose employee list changes constantly.
   *
   * `.first()` is intentional and not a positional guess — the scenario is
   * explicitly "pick any existing employee", and which one is irrelevant.
   *
   * CAUTION for callers: the returned hint text includes the employee's MIDDLE
   * name (e.g. "A8DCo 4Ys 010Z"), but the list's Employee Name column renders
   * first + last only (e.g. "A8DCo 010Z"). Confirmed live. Never assert that
   * the list cell equals this return value. Some hints also contain a double
   * space where the middle name is empty.
   */
  async pickFirstEmployeeHint(hintChar = 'a'): Promise<string> {
    // Sync on the autocomplete's own lookup so the suggestions are actually
    // being rendered before anything is clicked.
    // Confirmed live: GET .../api/v2/pim/employees?nameOrId=a => 200.
    await Promise.all([
      this.page.waitForResponse((res) =>
        res.url().includes(AddUserPage.employeeLookupEndpoint),
      ),
      this.employeeNameInput.fill(hintChar),
    ]);

    // CSS last resort for the container: the autocomplete's options DO expose
    // role=option, but so do the User Role / Status dropdowns, so this is
    // scoped by the autocomplete's own option class to stay unambiguous.
    //
    // `hasNotText` is essential, not defensive. Confirmed live: while the
    // lookup is in flight the dropdown renders a single
    // `.oxd-autocomplete-option` reading "Searching...." for ~500ms. Taking
    // `.first()` without excluding it clicks the loading placeholder, which
    // selects no employee — the field keeps the raw hint character and Save
    // then fails with an "Invalid" message on Employee Name. Filtering it out
    // makes the locator resolve only once real suggestions have replaced it,
    // and `waitFor` supplies the retry.
    const firstHint = this.page
      .locator('.oxd-autocomplete-option')
      .filter({ hasNotText: 'Searching' })
      .first();
    await firstHint.waitFor({ state: 'visible' });

    const hintText = (await firstHint.innerText()).trim();
    await firstHint.click();

    // The suggestion list closes once a real employee has been selected.
    // Waiting for that is the sync point proving the pick landed, and unlike
    // comparing the input's value it does not depend on how the app normalises
    // the name (some hints contain a double space where the middle name is
    // empty, e.g. "Ranga  Akunuri").
    await firstHint.waitFor({ state: 'detached' });

    return hintText;
  }

  /**
   * Fills Username and waits for its asynchronous uniqueness check to come
   * back, so a following Save cannot outrun a pending validation request.
   */
  async fillUsernameAndAwaitValidation(username: string): Promise<void> {
    await Promise.all([
      this.page.waitForResponse((res) =>
        res.url().includes(AddUserPage.usernameValidationEndpoint),
      ),
      this.usernameInput.fill(username),
    ]);
  }

  /** Fills Password and Confirm Password with the same value. */
  async fillPasswords(password: string): Promise<void> {
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(password);
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  /**
   * Fills every required field with valid values and saves.
   * Returns the employee hint text that was picked at runtime.
   */
  async createUser(data: {
    userRole: string;
    status: string;
    username: string;
    password: string;
    employeeHintChar?: string;
  }): Promise<string> {
    await this.selectUserRole(data.userRole);
    const employeeHint = await this.pickFirstEmployeeHint(data.employeeHintChar);
    await this.selectStatus(data.status);
    await this.fillUsernameAndAwaitValidation(data.username);
    await this.fillPasswords(data.password);
    await this.save();
    return employeeHint;
  }
}
