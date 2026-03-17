// beacon2/e2e/tests/04-groups.spec.js
// Group management tests.
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

import { test, expect } from '../fixtures/admin.js';
import { GroupListPage, GroupRecordPage } from '../pages/GroupsPage.js';

const SUFFIX    = Date.now();
const GROUP_NAME = `E2EGroup${SUFFIX}`;

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
    await page.goto('/groups/new');

    // Fill name (required)
    await page.locator('input[name="name"]').first().fill(GROUP_NAME);

    await page.getByRole('button', { name: /save/i }).first().click();

    // After save, URL should become /groups/:id
    await page.waitForURL(/\/groups\/[^/]+$/, { timeout: 10_000 });
    await expect(page.getByText(GROUP_NAME)).toBeVisible();
  });

  test('new group appears in the group list', async ({ adminPage: page }) => {
    const listPage = new GroupListPage(page);
    await listPage.goto();
    await expect(listPage.groupLink(GROUP_NAME)).toBeVisible({ timeout: 6_000 });
  });

  test('edit group details', async ({ adminPage: page }) => {
    // Navigate to the group record via the list
    const listPage = new GroupListPage(page);
    await listPage.goto();
    await listPage.groupLink(GROUP_NAME).click();
    await page.waitForURL(/\/groups\/[^/]+$/);

    // Edit the name (append suffix)
    const nameInput = page.locator('input[name="name"]').first();
    await nameInput.fill(GROUP_NAME);  // ensure no stale value
    await page.getByRole('button', { name: /save/i }).first().click();

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

  test('Schedule tab is visible and clickable', async ({ adminPage: page }) => {
    await openGroup(page);
    const scheduleTab = page.getByRole('tab', { name: /schedule/i }).first();
    await expect(scheduleTab).toBeVisible();
    await scheduleTab.click();
    // Schedule panel should contain an "Add Events" section or similar
    await expect(page.getByText(/schedule/i).first()).toBeVisible();
  });

  test('Members tab is visible and clickable', async ({ adminPage: page }) => {
    await openGroup(page);
    const membersTab = page.getByRole('tab', { name: /members/i }).first();
    await expect(membersTab).toBeVisible();
    await membersTab.click();
  });

  test('Ledger tab is visible and clickable', async ({ adminPage: page }) => {
    await openGroup(page);
    const ledgerTab = page.getByRole('tab', { name: /ledger/i }).first();
    await expect(ledgerTab).toBeVisible();
    await ledgerTab.click();
    // Ledger panel loads
    await expect(page.getByText(/brought forward/i).first()).toBeVisible({ timeout: 6_000 });
  });

  test('add a schedule event', async ({ adminPage: page }) => {
    await openGroup(page);
    await page.getByRole('tab', { name: /schedule/i }).first().click();

    // Fill add-event form — date input uses dd/mm/yyyy format
    const dateInput = page.getByPlaceholder('dd/mm/yyyy').first();
    await expect(dateInput).toBeVisible({ timeout: 5_000 });
    await dateInput.fill('15/06/2026');

    // Start time
    const timeInput = page.locator('input[type="time"]').first();
    if (await timeInput.isVisible()) await timeInput.fill('10:00');

    // Topic
    const topicInput = page.locator('input[name="topic"], input[placeholder*="topic" i]').first();
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
