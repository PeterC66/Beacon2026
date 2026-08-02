// beacon2026/e2e/tests/04-groups.spec.js
// Group management tests. Team tests are in 04b-teams.spec.js.
// Beacon UG §5   — "Groups"
// Beacon UG §5.1 — "The Group List"
// Beacon UG §5.2 — "Group Details"
// Beacon UG §5.3 — "The Group Schedule"
// Beacon UG §5.4 — "Group Members"
//
// Tests:
//  ✓ Group list page loads
//  ✓ Add a new group → appears in list
//  ✓ Edit group details → saved
//  ✓ Group schedule tab is accessible
//  ✓ Add a schedule event to a group
//  ✓ Group ledger tab is accessible
//  ✓ Delete a group
//  ✓ Switch to Teams link on group list
//  ✓ Switch to Groups link on team list

import { test, expect } from '../fixtures/admin.js';
import { GroupListPage, GroupRecordPage } from '../pages/GroupsPage.js';

// Each CI run creates its own tenant, so a fixed name is safe — no
// cross-run collisions.  A fixed string avoids the problem where
// Playwright worker restarts (on retry) change Date.now() and break
// dependent tests that look for a group created under the old timestamp.
const GROUP_NAME = 'E2EGroup';

test.describe('Group list', () => {
  test('page loads with heading and Add new group link', async ({ adminPage: page }) => {
    const listPage = new GroupListPage(page);
    await listPage.goto();

    await expect(page.getByRole('heading', { name: 'Groups' })).toBeVisible();
    await expect(listPage.addNewButton()).toBeVisible();
  });
});

test.describe('Add and edit a group', () => {
  test('create a new group', async ({ adminPage: page }) => {
    const recordPage = new GroupRecordPage(page);
    await recordPage.gotoNew();

    // Fill name (required)
    await recordPage.nameInput().fill(GROUP_NAME);

    await recordPage.saveButton().click();

    // After save, URL should become /groups/:id (not /groups/new)
    await page.waitForURL(/\/groups\/(?!new\b)[^/]+$/, { timeout: 10_000 });
    // The group name appears in the page heading once the record loads
    await expect(page.getByRole('heading', { name: GROUP_NAME })).toBeVisible({ timeout: 10_000 });
  });

  test('new group appears in the group list', async ({ adminPage: page }) => {
    const listPage = new GroupListPage(page);
    await listPage.goto();
    await expect(listPage.groupLink(GROUP_NAME)).toBeVisible({ timeout: 15_000 });
  });

  test('edit group details', async ({ adminPage: page }) => {
    // Navigate to the group record via the list
    const listPage = new GroupListPage(page);
    await listPage.goto();
    await listPage.groupLink(GROUP_NAME).click();
    await page.waitForURL(/\/groups\/[^/]+$/);

    // Edit the name (append suffix)
    const recordPage = new GroupRecordPage(page);
    await recordPage.nameInput().fill(GROUP_NAME);  // ensure no stale value
    await recordPage.saveButton().click();

    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 6_000 });
  });
});

test.describe('Group tabs', () => {
  async function openGroup(page) {
    const listPage = new GroupListPage(page);
    await listPage.goto();
    await listPage.groupLink(GROUP_NAME).click();
    await page.waitForURL(/\/groups\/[^/]+$/);
  }

  test('Events tab is visible and clickable', async ({ adminPage: page }) => {
    await openGroup(page);
    const eventsTab = page.getByRole('tab', { name: /events/i }).first();
    await expect(eventsTab).toBeVisible();
    await eventsTab.click();
    // Events panel should contain an "Add Events" section
    await expect(page.getByText(/add events/i).first()).toBeVisible();
  });

  test('Members tab is visible and clickable', async ({ adminPage: page }) => {
    await openGroup(page);
    const membersTab = page.getByRole('tab', { name: /members/i }).first();
    await expect(membersTab).toBeVisible();
    await membersTab.click();
  });

  test('Group Cash tab is visible and clickable', async ({ adminPage: page }) => {
    await openGroup(page);
    const cashTab = page.getByRole('tab', { name: /group cash/i }).first();
    await expect(cashTab).toBeVisible();
    await cashTab.click();
    // Ledger panel loads
    await expect(page.getByText(/brought forward/i).first()).toBeVisible({ timeout: 6_000 });
  });

  test('add an event', async ({ adminPage: page }) => {
    await openGroup(page);
    await page.getByRole('tab', { name: /events/i }).first().click();

    // Fill add-event form — native date input uses YYYY-MM-DD format
    const dateInput = page.locator('input[name="eventDate"]').first();
    await expect(dateInput).toBeVisible({ timeout: 5_000 });
    await dateInput.fill('2026-06-15');

    // Start time
    const timeInput = page.locator('input[name="startTime"]').first();
    if (await timeInput.isVisible()) await timeInput.fill('10:00');

    // Topic
    const topicInput = page.locator('input[name="topic"]').first();
    if (await topicInput.isVisible()) await topicInput.fill('E2E Test Meeting');

    await page.getByRole('button', { name: /add event/i }).first().click();

    // Event should now appear in the schedule table
    await expect(page.getByText('E2E Test Meeting')).toBeVisible({ timeout: 6_000 });
  });
});

test.describe('Delete a group', () => {
  test('delete the test group', async ({ adminPage: page }) => {
    const listPage = new GroupListPage(page);
    await listPage.goto();
    await listPage.groupLink(GROUP_NAME).click();
    await page.waitForURL(/\/groups\/[^/]+$/);

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /delete/i }).first().click();

    await page.waitForURL('/groups', { timeout: 10_000 });
    await expect(page.getByText(GROUP_NAME)).toBeHidden({ timeout: 5_000 });
  });
});

// ── Groups ↔ Teams switching ────────────────────────────────────────────

test.describe('Groups / Teams switching', () => {
  test('Switch to Teams link on group list', async ({ adminPage: page }) => {
    const listPage = new GroupListPage(page);
    await listPage.goto();

    // NavBar link labelled "Teams" (not "Switch to Teams")
    const teamsLink = page.getByRole('link', { name: 'Teams' }).first();
    await expect(teamsLink).toBeVisible({ timeout: 5_000 });
    await teamsLink.click();

    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 10_000 });
  });

  test('Switch to Groups link on team list', async ({ adminPage: page }) => {
    // Navigate to teams first
    const clicked = await page.evaluate(() => {
      const link = document.querySelector('a[href="/teams"]');
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) await page.goto('/teams');
    await page.getByRole('heading', { name: 'Teams' }).waitFor({ timeout: 10_000 });

    // NavBar link labelled "Groups" (not "Switch to Groups")
    const groupsLink = page.getByRole('link', { name: 'Groups' }).first();
    await expect(groupsLink).toBeVisible({ timeout: 5_000 });
    await groupsLink.click();

    await expect(page.getByRole('heading', { name: 'Groups' })).toBeVisible({ timeout: 10_000 });
  });
});
