import { Locator, Page, Response } from '@playwright/test';
import { BasePage } from './base.page';

/** The four filter labels rendered in the System Users search panel. */
export type SystemUserFilterLabel = 'Username' | 'User Role' | 'Employee Name' | 'Status';

/**
 * Escapes a runtime value so it can be embedded in a RegExp safely. Generated
 * usernames are alphanumeric + underscore today, but this keeps an exact-match
 * assertion honest if that ever changes.
 */
function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Admin > User Management > System Users — the list page.
 *
 * Every locator below was confirmed live against the demo instance
 * (OrangeHRM OS 5.9) on 2026-08-14 via Playwright MCP.
 *
 * Why this page leans on CSS more than CLAUDE.md would normally allow: four
 * of this feature's inputs (this page's Username filter, plus the Add form's
 * Username / Password / Confirm Password) have NO accessible name, NO
 * `for`-associated label and NO placeholder, and the row action buttons have
 * EMPTY accessible names. `getByRole`/`getByLabel` cannot reach them at all.
 * Each such locator is commented individually. `getByRole` IS used wherever
 * it actually resolves: the heading, the buttons, the table rows/cells, the
 * column headers and the dropdown options.
 */
export class SystemUsersPage extends BasePage {
  /** List path — relative, resolved against baseURL from .env. */
  static readonly path = '/web/index.php/admin/viewSystemUsers';

  /**
   * The grid's own fetch. Used as a deterministic sync point after Search and
   * after a delete, so assertions never race a pending refetch.
   * Confirmed live: GET .../api/v2/admin/users?limit=50&offset=0&username=...
   * Note the trailing "?" — it keeps this from also matching the POST/DELETE
   * to the same path, and from matching /admin/validation/user-name.
   */
  private static readonly listEndpoint = '/api/v2/admin/users?';

  /**
   * Data rows only. Scoped to the table body so the header row is excluded,
   * then resolved by role.
   */
  readonly dataRows: Locator;

  readonly heading: Locator;
  readonly usernameFilterInput: Locator;
  readonly employeeNameFilterInput: Locator;
  readonly resetButton: Locator;
  readonly searchButton: Locator;
  readonly addButton: Locator;
  readonly recordCount: Locator;
  readonly noRecordsFound: Locator;
  readonly errorToast: Locator;

  /* --- delete confirmation --- */
  readonly confirmDialog: Locator;
  readonly confirmDialogTitle: Locator;
  readonly confirmDialogMessage: Locator;
  readonly confirmDeleteButton: Locator;
  readonly cancelDeleteButton: Locator;

  /**
   * The Username column, positionally. A table column IS inherently
   * positional — the cells carry no distinguishing attribute — so this is the
   * only way to read one specific column. The column's position is not
   * assumed blindly: the list-loads scenario asserts the column headers in
   * order, which pins this index. Confirmed live: nth-child(1) is the
   * select-all checkbox cell, nth-child(2) is Username.
   */
  private static readonly usernameColumnCell = '.oxd-table-cell:nth-child(2)';

  constructor(page: Page) {
    super(page);

    this.heading = page.getByRole('heading', { name: 'System Users', level: 5 });

    // CSS last resort: this input has no accessible name, no placeholder and
    // its <label> has no `for` attribute, so getByRole/getByLabel cannot
    // reach it. Scoped by the input group holding an EXACTLY matching label,
    // which is stable and non-positional. (`:text-is` matters — a substring
    // match would make "Password" also match "Confirm Password" on the Add
    // form, which reuses this same pattern.)
    this.usernameFilterInput = this.inputGroupFor('Username').locator('input');

    // This one does have a placeholder, so it follows the preferred order.
    this.employeeNameFilterInput = page.getByPlaceholder('Type for hints...');

    this.resetButton = page.getByRole('button', { name: 'Reset', exact: true });
    this.searchButton = page.getByRole('button', { name: 'Search', exact: true });
    // Confirmed live: the accessible name is " Add" — a leading space
    // contributed by the button's icon. Matched by regex per the plan.
    this.addButton = page.getByRole('button', { name: /Add/ });

    this.dataRows = page.locator('.oxd-table-body').getByRole('row');

    // CSS last resort: the record-count / "No Records Found" text is a bare
    // <span> with no role and no accessible name of its own.
    this.recordCount = page.locator('.oxd-text--span').filter({ hasText: /\(\d+\) Records? Found/ });
    // Scoped to `.oxd-text--span` rather than a bare getByText: confirmed live
    // that the empty result ALSO raises an info toast whose text is the
    // identical string "No Records Found", so an unscoped getByText matches two
    // elements and fails on strict mode. The toast is a <p class="oxd-text--p">,
    // so restricting to the span class selects the stable inline node and
    // ignores the racy, auto-dismissing toast.
    this.noRecordsFound = page
      .locator('.oxd-text--span')
      .filter({ hasText: /^No Records Found$/ });

    // CSS last resort: toasts expose no role. Deliberately targets the ERROR
    // variant only — an *info* toast ("No Records Found") is expected on an
    // empty result and must not be treated as a failure.
    this.errorToast = page.locator('.oxd-toast--error');

    // The plan warned that the confirmation sheet is role=document, not
    // role=dialog. The sheet IS role=document — but role=document is unusable
    // as a locator here, because <html> also carries an implicit role=document,
    // so getByRole('document') matches two elements and fails strict mode.
    //
    // Re-verified live instead: an ancestor overlay DOES expose role=dialog,
    // there is exactly one of it in the page, it is `display: none` and empty
    // while closed, and it hosts the sheet (title, message and both buttons)
    // while open. So it is unique, it is a meaningful visibility target, and it
    // is the preferred role-based strategy.
    this.confirmDialog = page.getByRole('dialog');
    this.confirmDialogTitle = this.confirmDialog.getByText('Are you Sure?', { exact: true });
    this.confirmDialogMessage = this.confirmDialog.getByText(
      'The selected record will be permanently deleted. Are you sure you want to continue?',
      { exact: true },
    );
    // Confirmed live: the accessible name is " Yes, Delete" with a LEADING
    // SPACE from its icon, so an exact string match fails — hence the regex.
    // "No, Cancel" normalises clean, but is matched by regex too for symmetry.
    this.confirmDeleteButton = this.confirmDialog.getByRole('button', { name: /Yes, Delete/ });
    this.cancelDeleteButton = this.confirmDialog.getByRole('button', { name: /No, Cancel/ });
  }

  /**
   * The `.oxd-input-group` wrapper whose <label> is exactly `label`.
   *
   * CSS last resort, and the workaround the whole feature depends on: these
   * groups expose no role, no test id, and their labels have no `for`
   * attribute. Confirmed live that the label element's own text is exactly
   * "Username" / "Password" / "Confirm Password" — the required-field "*" is
   * a SIBLING element, not part of the label text — so `:text-is()` gives a
   * clean, unambiguous, non-positional match.
   */
  protected inputGroupFor(label: string): Locator {
    return this.page.locator(`.oxd-input-group:has(label:text-is("${label}"))`);
  }

  /** The filter panel's label for one of the four search fields. */
  filterLabel(label: SystemUserFilterLabel): Locator {
    return this.inputGroupFor(label).locator('label');
  }

  /** A results-table column header, matched on its leading text. */
  columnHeader(name: string): Locator {
    // Confirmed live: header accessible names carry a TRAILING SPACE from the
    // sort icon ("Username ", "User Role ", "Employee Name ", "Status "),
    // while "Actions" does not — so anchor the regex at the start only.
    return this.page.getByRole('columnheader', { name: new RegExp(`^${name}`) });
  }

  /**
   * A custom dropdown trigger (User Role / Status).
   *
   * CSS last resort: the trigger is a <div>, not a <select>, so
   * `selectOption()` cannot be used and it exposes no usable role or name.
   */
  private dropdownTrigger(label: 'User Role' | 'Status'): Locator {
    return this.inputGroupFor(label).locator('.oxd-select-text');
  }

  /** Opens a custom dropdown and picks an option by its visible text. */
  protected async selectFromDropdown(
    label: 'User Role' | 'Status',
    option: string,
  ): Promise<void> {
    await this.dropdownTrigger(label).click();
    // The options DO expose role=option inside a role=listbox, so the
    // preferred locator strategy applies here. Only one dropdown is ever
    // open at a time, so this is unambiguous.
    await this.page.getByRole('option', { name: option, exact: true }).click();
  }

  /** The visible text of a dropdown's current selection. */
  dropdownValue(label: 'User Role' | 'Status'): Locator {
    return this.dropdownTrigger(label);
  }

  /** The User Role / Status filter triggers, for structural assertions. */
  get userRoleFilter(): Locator {
    return this.dropdownTrigger('User Role');
  }

  get statusFilter(): Locator {
    return this.dropdownTrigger('Status');
  }

  async open(): Promise<void> {
    await this.navigate(SystemUsersPage.path);
  }

  /** Waits for the grid's own fetch to settle while `action` runs. */
  private async withGridRefresh(action: () => Promise<void>): Promise<Response> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (res) => res.url().includes(SystemUsersPage.listEndpoint) && res.request().method() === 'GET',
      ),
      action(),
    ]);
    return response;
  }

  /**
   * Types a username into the filter and searches, waiting for the grid to
   * actually refetch so callers never assert against stale rows.
   */
  async searchByUsername(username: string): Promise<void> {
    await this.usernameFilterInput.fill(username);
    await this.withGridRefresh(async () => {
      await this.searchButton.click();
    });
  }

  async clickAdd(): Promise<void> {
    await this.addButton.click();
  }

  /**
   * A Username-column cell, matched against `pattern`.
   *
   * Uses `filter({ hasText })` rather than the CSS `:text-is()` pseudo-class.
   * Confirmed live that this matters: the cell wraps its text in an inner
   * <div> (`<div class="oxd-table-cell"><div>Admin</div></div>`), and
   * `:text-is()` matches the SMALLEST element containing the text — the inner
   * div — so `.oxd-table-cell:nth-child(2):text-is("Admin")` matches nothing.
   * `hasText` matches an element's full text at any depth, so it works.
   */
  private usernameCellMatching(pattern: RegExp): Locator {
    return this.page.locator(SystemUsersPage.usernameColumnCell).filter({ hasText: pattern });
  }

  /** The single data row whose USERNAME cell is exactly `username`. */
  rowFor(username: string): Locator {
    // Matched on the Username column specifically, not on "any cell": the
    // User Role column also contains the value "Admin", so a whole-row match
    // on ADMIN_USERNAME would produce false positives.
    return this.dataRows.filter({
      has: this.usernameCellMatching(new RegExp(`^${escapeForRegExp(username)}$`)),
    });
  }

  /**
   * Data rows whose Username cell does NOT contain `term` — i.e. rows that a
   * username filter should never have returned. Exposed as a locator so the
   * spec can assert `toHaveCount(0)` with auto-retry.
   */
  rowsNotMatchingUsername(term: string): Locator {
    return this.dataRows.filter({
      hasNot: this.usernameCellMatching(new RegExp(escapeForRegExp(term), 'i')),
    });
  }

  /** One cell of a given row, by column name. */
  cellIn(row: Locator, column: 'Username' | 'User Role' | 'Employee Name' | 'Status'): Locator {
    // Positional for the same reason as usernameColumnCell — a column has no
    // identity other than its index, and the header order is asserted by the
    // list-loads scenario.
    const index = { Username: 2, 'User Role': 3, 'Employee Name': 4, Status: 5 }[column];
    return row.locator(`.oxd-table-cell:nth-child(${index})`);
  }

  /**
   * The delete (trash) action button on a specific row.
   *
   * CSS last resort: both row action buttons have EMPTY accessible names.
   * Rather than relying on document order ("delete is the first button"),
   * this targets the trash icon class — confirmed live as `bi-trash` for
   * delete and `bi-pencil-fill` for edit. That makes the intent explicit and
   * removes the risk of silently clicking Edit if the order ever changes.
   */
  deleteButtonFor(username: string): Locator {
    return this.rowFor(username).locator('button:has(i.bi-trash)');
  }

  /** Opens the delete confirmation for one row. */
  async clickDeleteFor(username: string): Promise<void> {
    await this.deleteButtonFor(username).click();
  }

  /** Confirms the delete and waits for the grid to refetch. */
  async confirmDelete(): Promise<void> {
    await this.withGridRefresh(async () => {
      await this.confirmDeleteButton.click();
    });
  }

  /**
   * Best-effort cleanup: removes a user this test created, if it still exists.
   *
   * Deliberately scoped to an EXACT username match on the Username column, so
   * it can never touch a pre-existing or seeded account on this shared demo
   * instance. Safe to call when the user was never created or already went
   * away, which is what makes it usable from an always-runs cleanup hook.
   */
  async deleteUserIfPresent(username: string): Promise<void> {
    await this.open();
    await this.searchByUsername(username);

    if ((await this.rowFor(username).count()) === 0) {
      return;
    }

    await this.clickDeleteFor(username);
    await this.confirmDelete();
  }
}
