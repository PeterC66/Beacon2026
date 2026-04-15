// beacon2/e2e/tests/04b-teams.spec.js
// Team management tests — split from 04-groups.spec.js to match
// the pages/teams/ directory created by R8.
//
// Tests:
//  ✓ Team list page loads
//  ✓ Add a new team → appears in list
//  ✓ Team tabs: Schedule and Ledger are accessible
//  ✓ Add a schedule event to a team
//  ✓ Delete a team

import { test, expect } from '../fixtures/admin.js';
import { TeamListPage, TeamRecordPage } from '../pages/TeamsPage.js';

const SUFFIX    = Date.now();
const TEAM_NAME = `E2ETeam${SUFFIX}`;

test.describe('Team list', () => {
  test('page loads with heading', async ({ adminPage: page }) => {
    const listPage = new TeamListPage(page);
    await listPage.goto();
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible();
  });
});

test.describe('Add and edit a team', () => {
  test('create a new team', async ({ adminPage: page }) => {
    const recordPage = new TeamRecordPage(page);
    await recordPage.gotoNew();

    await recordPage.nameInput().fill(TEAM_NAME);
    await recordPage.saveButton().click();

    // After save, URL should become /teams/:id
    await page.waitForURL(/\/teams\/(?!new\b)[^/]+$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: TEAM_NAME })).toBeVisible({ timeout: 10_000 });
  });

  test('new team appears in the team list', async ({ adminPage: page }) => {
    const listPage = new TeamListPage(page);
    await listPage.goto();
    await expect(listPage.teamLink(TEAM_NAME)).toBeVisible({ timeout: 6_000 });
  });
});

test.describe('Team tabs', () => {
  async function openTeam(page) {
    const listPage = new TeamListPage(page);
    await listPage.goto();
    await listPage.teamLink(TEAM_NAME).click();
    await expect(page.getByRole('heading', { name: TEAM_NAME })).toBeVisible({ timeout: 10_000 });
  }

  test('Schedule tab is visible and clickable', async ({ adminPage: page }) => {
    await openTeam(page);
    const scheduleTab = page.getByRole('tab', { name: /schedule/i }).first();
    await expect(scheduleTab).toBeVisible();
    await scheduleTab.click();
    await expect(page.getByText(/schedule/i).first()).toBeVisible();
  });

  test('Ledger tab is visible and clickable', async ({ adminPage: page }) => {
    await openTeam(page);
    const ledgerTab = page.getByRole('tab', { name: /ledger/i }).first();
    await expect(ledgerTab).toBeVisible();
    await ledgerTab.click();
    await expect(page.getByText(/brought forward/i).first()).toBeVisible({ timeout: 6_000 });
  });

  test('add a schedule event to a team', async ({ adminPage: page }) => {
    await openTeam(page);
    await page.getByRole('tab', { name: /schedule/i }).first().click();

    const dateInput = page.locator('input[name="eventDate"]').first();
    await expect(dateInput).toBeVisible({ timeout: 5_000 });
    await dateInput.fill('2026-07-15');

    const timeInput = page.locator('input[name="startTime"]').first();
    if (await timeInput.isVisible()) await timeInput.fill('14:00');

    const topicInput = page.locator('input[name="topic"]').first();
    if (await topicInput.isVisible()) await topicInput.fill('E2E Team Meeting');

    await page.getByRole('button', { name: /add event/i }).first().click();

    await expect(page.getByText('E2E Team Meeting')).toBeVisible({ timeout: 6_000 });
  });
});

test.describe('Delete a team', () => {
  test('delete the test team', async ({ adminPage: page }) => {
    const listPage = new TeamListPage(page);
    await listPage.goto();
    await listPage.teamLink(TEAM_NAME).click();
    await expect(page.getByRole('heading', { name: TEAM_NAME })).toBeVisible({ timeout: 10_000 });

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /delete/i }).first().click();

    await page.waitForURL('/teams', { timeout: 10_000 });
    await expect(page.getByText(TEAM_NAME)).toBeHidden({ timeout: 5_000 });
  });
});
