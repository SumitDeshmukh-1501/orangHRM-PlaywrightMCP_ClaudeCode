import { expect, test } from "../../../fixtures/logger.fixture";
import { AddUserPage } from "../../../pages/add-user.page";
import { SystemUsersPage } from "../../../pages/system-users.page";
import { adminCredentials } from "../../../utils/env";
import {
  randomBogusUsername,
  randomStrongPassword,
  randomUsername,
} from "../../../utils/test-data";

/**
 * Admin > User Management > System Users — UI scenarios from
 * test-plans/admin-system-users.plan.json.
 *
 * Authentication: none of these tests log in. The `ui` project starts already
 * authenticated as Admin from the storageState written once by
 * tests/ui/auth.setup.ts, so there is deliberately no beforeEach login here.
 *
 * Shared-instance discipline (this is a PUBLIC demo instance):
 *  - Every test that creates a system user deletes it in a `finally` block, so
 *    cleanup runs even when the assertions fail.
 *  - Rows are only ever targeted by an EXACT match on a username this test
 *    generated. No pre-existing or seeded account is deleted, edited or
 *    checkbox-selected, and the header select-all checkbox is never clicked.
 *  - No test asserts an absolute record count: the unfiltered total was
 *    observed drifting 6 -> 8 within minutes of this file being written, purely
 *    from other people's writes to the same instance.
 */

test.describe("System Users (UI)", () => {
  test(
    "admin-system-users-list-loads — System Users list loads with all four data columns and returns records",
    { tag: ["@smoke", "@functional"] },
    async ({ page, log }, testInfo) => {
      const usersPage = new SystemUsersPage(page);

      log.step(testInfo.title, "opening the System Users list");
      await usersPage.open();

      log.step(testInfo.title, "expecting the card heading");
      await expect(usersPage.heading).toBeVisible();

      log.step(
        testInfo.title,
        "expecting the four filter fields and the action buttons"
      );
      await expect(usersPage.filterLabel("Username")).toBeVisible();
      await expect(usersPage.filterLabel("User Role")).toBeVisible();
      await expect(usersPage.filterLabel("Employee Name")).toBeVisible();
      await expect(usersPage.filterLabel("Status")).toBeVisible();
      await expect(usersPage.usernameFilterInput).toBeVisible();
      await expect(usersPage.userRoleFilter).toBeVisible();
      await expect(usersPage.employeeNameFilterInput).toBeVisible();
      await expect(usersPage.statusFilter).toBeVisible();
      await expect(usersPage.resetButton).toBeEnabled();
      await expect(usersPage.searchButton).toBeEnabled();

      log.step(
        testInfo.title,
        "expecting the five results-table column headers"
      );
      // Asserting these in order also pins the column indexes that
      // SystemUsersPage.cellIn() relies on to read a specific column.
      await expect(usersPage.columnHeader("Username")).toBeVisible();
      await expect(usersPage.columnHeader("User Role")).toBeVisible();
      await expect(usersPage.columnHeader("Employee Name")).toBeVisible();
      await expect(usersPage.columnHeader("Status")).toBeVisible();
      await expect(usersPage.columnHeader("Actions")).toBeVisible();

      log.step(
        testInfo.title,
        "expecting at least one data row and a record count"
      );
      // "At least one" rather than an exact number — see the file header.
      await expect(usersPage.dataRows.first()).toBeVisible();
      // `recordCount` is filtered by /\(\d+\) Records? Found/, so this
      // resolving at all IS the assertion that the count text has that shape.
      // The regex covers the singular/plural switch confirmed live:
      // "(1) Record Found" vs "(8) Records Found".
      await expect(usersPage.recordCount).toBeVisible();
    }
  );

  test(
    "admin-system-users-search-by-username — Filtering by Username narrows the list to matching users only",
    { tag: ["@smoke", "@functional"] },
    async ({ page, log }, testInfo) => {
      const usersPage = new SystemUsersPage(page);
      // Guaranteed to exist as a system user: it is the account this suite
      // authenticates with.
      const { username } = adminCredentials();

      await usersPage.open();
      await expect(usersPage.heading).toBeVisible();

      log.step(testInfo.title, "searching by the admin username", { username });
      await usersPage.searchByUsername(username);

      log.step(
        testInfo.title,
        "expecting a record count and only matching rows"
      );
      await expect(usersPage.recordCount).toBeVisible();

      // The exact account is present. Usernames are unique (proven by the
      // "Already exists" check), so an exact-username match is exactly one row.
      await expect(usersPage.rowFor(username)).toHaveCount(1);

      // The filter did not leak non-matching rows. Whether the filter is exact
      // or partial/LIKE was never established, so this asserts the weaker
      // "every returned row contains the term" invariant rather than a count.
      await expect(usersPage.rowsNotMatchingUsername(username)).toHaveCount(0);
    }
  );

  test(
    'admin-system-users-search-no-match-empty-state — A search with no matches shows the "No Records Found" empty state, not an error',
    { tag: ["@functional", "@regression"] },
    async ({ page, log }, testInfo) => {
      const usersPage = new SystemUsersPage(page);
      const impossibleUsername = randomBogusUsername();

      await usersPage.open();
      await expect(usersPage.heading).toBeVisible();

      log.step(testInfo.title, "searching for a username that cannot exist", {
        username: impossibleUsername,
      });
      await usersPage.searchByUsername(impossibleUsername);

      log.step(testInfo.title, "expecting the inline empty state");
      // Confirmed live: the "(n) Records Found" node is REPLACED by the exact
      // text "No Records Found" — it is not "(0) Records Found".
      await expect(usersPage.noRecordsFound).toBeVisible();
      await expect(usersPage.recordCount).toHaveCount(0);

      log.step(testInfo.title, "expecting zero rows but an intact header row");
      await expect(usersPage.dataRows).toHaveCount(0);
      await expect(usersPage.columnHeader("Username")).toBeVisible();
      await expect(usersPage.columnHeader("User Role")).toBeVisible();
      await expect(usersPage.columnHeader("Employee Name")).toBeVisible();
      await expect(usersPage.columnHeader("Status")).toBeVisible();

      log.step(testInfo.title, "expecting no ERROR toast");
      // Asserts the absence of an error toast specifically. An *info* toast
      // ("Info" / "No Records Found") IS expected here and auto-dismisses, so
      // asserting "no toast at all" would be wrong, and asserting on the info
      // toast's text would be racy.
      await expect(usersPage.errorToast).toHaveCount(0);
    }
  );

  test(
    "admin-system-users-add-new-user — Admin can create a new ESS system user and it appears in the list",
    { tag: ["@smoke", "@functional", "@e2e"] },
    async ({ page, log }, testInfo) => {
      const usersPage = new SystemUsersPage(page);
      const addUserPage = new AddUserPage(page);
      const username = randomUsername();
      const password = randomStrongPassword();

      try {
        await test.step("open the Add User form", async () => {
          log.step(testInfo.title, "opening the System Users list");
          await usersPage.open();
          await expect(usersPage.heading).toBeVisible();

          log.step(testInfo.title, "clicking Add");
          await usersPage.clickAdd();
          await expect(page).toHaveURL(AddUserPage.formPath);
          await expect(addUserPage.formHeading).toBeVisible();
        });

        await test.step("fill and save the form", async () => {
          log.step(testInfo.title, "filling the six required fields", {
            username,
          });
          // The "an employee must exist" precondition is satisfied at runtime
          // by discovering one from the autocomplete — no API setup helper.
          const employeeHint = await addUserPage.createUser({
            userRole: "ESS",
            status: "Enabled",
            username,
            password,
          });
          // Captured for the run log only. Deliberately NOT compared with the
          // list's Employee Name cell: the hint includes the middle name while
          // the cell renders first + last only.
          log.step(testInfo.title, "linked to an existing employee", {
            employeeHint,
          });
        });

        await test.step("verify the new user is in the list", async () => {
          log.step(testInfo.title, "expecting a redirect back to the list");
          await expect(page).toHaveURL(SystemUsersPage.path);

          log.step(testInfo.title, "searching for the new username");
          await usersPage.searchByUsername(username);

          const row = usersPage.rowFor(username);
          await expect(row).toHaveCount(1);
          await expect(usersPage.cellIn(row, "Username")).toHaveText(username);
          await expect(usersPage.cellIn(row, "User Role")).toHaveText("ESS");
          await expect(usersPage.cellIn(row, "Status")).toHaveText("Enabled");
        });
      } finally {
        // Runs even if the assertions above failed — nothing is left behind on
        // this shared instance. Scoped to this test's own generated username.
        log.step(testInfo.title, "cleanup: deleting the created user", {
          username,
        });
        await usersPage.deleteUserIfPresent(username);
      }
    }
  );

  test(
    "admin-system-users-add-required-field-validation — Saving the Add User form empty is blocked with inline validation on every required field",
    { tag: ["@functional", "@regression"] },
    async ({ page, log }, testInfo) => {
      const addUserPage = new AddUserPage(page);

      log.step(testInfo.title, "opening the Add User form");
      await addUserPage.open();
      await expect(addUserPage.formHeading).toBeVisible();
      await expect(addUserPage.requiredLegend).toBeVisible();

      log.step(testInfo.title, "clicking Save with every field untouched");
      await addUserPage.save();

      log.step(testInfo.title, 'expecting "Required" on the first five fields');
      await expect(addUserPage.validationMessageFor("User Role")).toHaveText(
        "Required"
      );
      await expect(
        addUserPage.validationMessageFor("Employee Name")
      ).toHaveText("Required");
      await expect(addUserPage.validationMessageFor("Status")).toHaveText(
        "Required"
      );
      await expect(addUserPage.validationMessageFor("Username")).toHaveText(
        "Required"
      );
      await expect(addUserPage.validationMessageFor("Password")).toHaveText(
        "Required"
      );

      log.step(
        testInfo.title,
        "expecting the asymmetric Confirm Password message"
      );
      // SUSPECTED PRODUCT BUG — asserted as OBSERVED, not as it "should" be.
      // An untouched, empty Confirm Password reports "Passwords do not match"
      // instead of "Required" like the other five fields, i.e. it is being
      // compared rather than required-checked. Re-verified live on 2026-08-14.
      //
      // Do NOT "heal" this to 'Required'. If OrangeHRM ever fixes the defect,
      // this assertion is meant to fail loudly so the change is reviewed.
      await expect(
        addUserPage.validationMessageFor("Confirm Password")
      ).toHaveText("Passwords do not match");

      log.step(
        testInfo.title,
        "expecting no navigation and therefore no user created"
      );
      await expect(page).toHaveURL(AddUserPage.formPath);
    }
  );

  test(
    'admin-system-users-add-duplicate-username — An already-taken username is rejected with "Already exists" and cannot be saved',
    { tag: ["@functional", "@regression"] },
    async ({ page, log }, testInfo) => {
      const addUserPage = new AddUserPage(page);
      // Guaranteed to already exist: the suite authenticates with it.
      const { username: existingUsername } = adminCredentials();
      const password = randomStrongPassword();

      log.step(testInfo.title, "opening the Add User form");
      await addUserPage.open();
      await expect(addUserPage.formHeading).toBeVisible();

      log.step(testInfo.title, "entering a username that already exists", {
        username: existingUsername,
      });
      // Waits for the asynchronous uniqueness check to return, so Save is
      // never raced against a pending validation request.
      await addUserPage.fillUsernameAndAwaitValidation(existingUsername);

      log.step(
        testInfo.title,
        'expecting "Already exists" without having clicked Save'
      );
      // Auto-retrying: the check is async and fires on input/blur, so the
      // message is not present synchronously.
      await expect(addUserPage.validationMessageFor("Username")).toHaveText(
        "Already exists"
      );

      log.step(
        testInfo.title,
        "filling the remaining required fields and clicking Save"
      );
      await addUserPage.selectUserRole("ESS");
      await addUserPage.pickFirstEmployeeHint();
      await addUserPage.selectStatus("Enabled");
      await addUserPage.fillPasswords(password);
      await addUserPage.save();

      log.step(testInfo.title, "expecting the save to be blocked");
      await expect(addUserPage.validationMessageFor("Username")).toHaveText(
        "Already exists"
      );
      await expect(page).toHaveURL(AddUserPage.formPath);
      // No cleanup needed: this test asserts that nothing was created.
    }
  );

  test(
    "admin-system-users-delete-user — Admin can delete a system user after confirming, and it disappears from the list",
    { tag: ["@functional", "@regression", "@e2e"] },
    async ({ page, log }, testInfo) => {
      const usersPage = new SystemUsersPage(page);
      const addUserPage = new AddUserPage(page);
      const username = randomUsername();
      const password = randomStrongPassword();

      try {
        await test.step("create the user this test will delete", async () => {
          // This test creates its OWN target. It must never delete a
          // pre-existing or seeded account on this shared instance.
          log.step(testInfo.title, "creating a user to delete", { username });
          await addUserPage.open();
          await expect(addUserPage.formHeading).toBeVisible();
          await addUserPage.createUser({
            userRole: "ESS",
            status: "Enabled",
            username,
            password,
          });
          await expect(page).toHaveURL(SystemUsersPage.path);
        });

        await test.step("locate the row by its generated username", async () => {
          log.step(testInfo.title, "searching so exactly one row is shown");
          await usersPage.searchByUsername(username);
          await expect(usersPage.rowFor(username)).toHaveCount(1);
        });

        await test.step("open and verify the confirmation dialog", async () => {
          log.step(testInfo.title, "clicking the row delete action");
          // Targets the trash icon within the row matched by generated
          // username — never a row index.
          await usersPage.clickDeleteFor(username);

          log.step(testInfo.title, "expecting the confirmation dialog");
          await expect(usersPage.confirmDialog).toBeVisible();
          await expect(usersPage.confirmDialogTitle).toBeVisible();
          await expect(usersPage.confirmDialogMessage).toBeVisible();
          await expect(usersPage.cancelDeleteButton).toBeVisible();
          await expect(usersPage.confirmDeleteButton).toBeVisible();
        });

        await test.step("confirm and verify the user is gone", async () => {
          log.step(testInfo.title, 'clicking "Yes, Delete"');
          await usersPage.confirmDelete();

          log.step(testInfo.title, "re-searching the deleted username");
          // The username filter survives the delete, but re-searching is the
          // more robust assertion.
          await usersPage.searchByUsername(username);

          await expect(usersPage.rowFor(username)).toHaveCount(0);
          await expect(usersPage.noRecordsFound).toBeVisible();
          await expect(usersPage.errorToast).toHaveCount(0);
        });
      } finally {
        // No-op on the happy path (the user is already gone), but guarantees
        // nothing is left behind if any step above failed after the create.
        log.step(
          testInfo.title,
          "cleanup: ensuring the user no longer exists",
          { username }
        );
        await usersPage.deleteUserIfPresent(username);
      }
    }
  );
});
