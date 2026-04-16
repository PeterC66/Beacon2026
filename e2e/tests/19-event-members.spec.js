// beacon2/e2e/tests/19-event-members.spec.js
// Event Members and Event Financials tests.
// Beacon UG §5.9 — "The Calendar" (event record, attendance, financials)
//
// Tests:
//  Setup:
//    ✓ Create a group for event tests
//    ✓ Add a schedule event to the group
//    ✓ Create a member for event tests
//    ✓ Add member to the test group
//  EventRecord navigation & details:
//    ✓ Calendar event link opens EventRecord Details tab
//    ✓ Details tab shows event info (date, time, group, topic)
//    ✓ All three tabs are visible and clickable
//  Event Members:
//    ✓ Initially no members registered
//    ✓ Add a member by name
//    ✓ Toggle organiser checkbox
//    ✓ Remove selected member
//    ✓ Copy members from group
//  Event Financials:
//    ✓ Add-transaction link is present
//    ✓ Create transaction linked to event
//  Schedule View link:
//    ✓ View link in group schedule opens EventRecord
//  Cleanup:
//    ✓ Delete the test member
//    ✓ Delete the test group

import { test, expect } from '../fixtures/admin.js';
import { GroupListPage, GroupRecordPage } from '../pages/GroupsPage.js';
import { MemberEditorPage } from '../pages/MemberEditorPage.js';
import { TransactionEditorPage } from '../pages/FinancePage.js';

// Fixed names — each CI run has its own tenant so no collision risk.
const GROUP_NAME  = 'E2EEvtGroup';
const MEMBER_SUR  = 'E2EEvtMbr';
const MEMBER_FORE = 'Eve';
const EVENT_TOPIC = 'E2E Event Test';
const EVENT_DATE  = '2026-06-15';
const TXN_PAYEE   = 'E2EEvtPayee';

// ── Helpers ─────────────────────────────────────────────────────────────

async function gotoHomeLink(page, href, headingText) {
  await page.evaluate(() => {
    const h = document.querySelector('a[href="/"]');
    if (h) h.click();
  });
  await page.waitForSelector(`a[href="${href}"]`, { timeout: 5_000 }).catch(() => null);
  const clicked = await page.evaluate((h) => {
    const link = document.querySelector(`a[href="${h}"]`);
    if (link) { link.click(); return true; }
    return false;
  }, href);
  if (!clicked) await page.goto(href);
  await page.getByRole('heading', { name: headingText }).waitFor({ timeout: 10_000 });
}

/** Navigate to Calendar, find the test event, click into EventRecord. */
async function gotoEventViaCalendar(page) {
  await gotoHomeLink(page, '/calendar', 'Calendar');
  // Wait for events to load — find the row containing our topic
  const eventRow = page.getByRole('row').filter({ hasText: EVENT_TOPIC });
  await expect(eventRow.first()).toBeVisible({ timeout: 15_000 });
  // The event link (date/time) is in the first cell of that row
  const eventLink = eventRow.locator('a[href^="/calendar/events/"]');
  await eventLink.first().click();
  await page.getByRole('heading', { name: EVENT_TOPIC }).waitFor({ timeout: 10_000 });
}

/** Navigate to EventRecord and switch to the Members tab. */
async function gotoEventMembersTab(page) {
  await gotoEventViaCalendar(page);
  await page.getByRole('tab', { name: /members/i }).first().click();
  // Wait for either "No members" or the member table to appear
  const noMembers = page.getByText(/no members registered/i);
  const memberCount = page.getByText(/\d+ member/);
  await expect(noMembers.or(memberCount).first()).toBeVisible({ timeout: 10_000 });
}

/** Navigate to EventRecord and switch to the Financials tab. */
async function gotoEventFinancialsTab(page) {
  await gotoEventViaCalendar(page);
  await page.getByRole('tab', { name: /financials/i }).first().click();
  await page.getByText(/income/i).first().waitFor({ timeout: 10_000 });
}

/** Open the test group record from the group list. */
async function openGroup(page) {
  const listPage = new GroupListPage(page);
  await listPage.goto();
  await listPage.groupLink(GROUP_NAME).click();
  await page.waitForURL(/\/groups\/[^/]+$/);
  await expect(page.getByRole('heading', { name: GROUP_NAME })).toBeVisible({ timeout: 10_000 });
}

// ── Setup ───────────────────────────────────────────────────────────────

test.describe('Event members setup', () => {
  test('create a group for event tests', async ({ adminPage: page }) => {
    const recordPage = new GroupRecordPage(page);
    await recordPage.gotoNew();
    await recordPage.nameInput().fill(GROUP_NAME);
    await recordPage.saveButton().click();
    await page.waitForURL(/\/groups\/(?!new\b)[^/]+$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: GROUP_NAME })).toBeVisible({ timeout: 10_000 });
  });

  test('add a schedule event to the group', async ({ adminPage: page }) => {
    await openGroup(page);
    await page.getByRole('tab', { name: /schedule/i }).first().click();

    const dateInput = page.locator('input[name="eventDate"]').first();
    await expect(dateInput).toBeVisible({ timeout: 5_000 });
    await dateInput.fill(EVENT_DATE);

    const timeInput = page.locator('input[name="startTime"]').first();
    if (await timeInput.isVisible()) await timeInput.fill('10:00');

    const topicInput = page.locator('input[name="topic"]').first();
    if (await topicInput.isVisible()) await topicInput.fill(EVENT_TOPIC);

    await page.getByRole('button', { name: /add event/i }).first().click();
    await expect(page.getByText(EVENT_TOPIC)).toBeVisible({ timeout: 6_000 });
  });

  test('create a member for event tests', async ({ adminPage: page }) => {
    const editor = new MemberEditorPage(page);
    await editor.gotoNew();

    await editor.fillMinimal({
      forenames:  MEMBER_FORE,
      surname:    MEMBER_SUR,
      statusName: 'Current',
      className:  'Individual',
      postcode:   'TE1 1ST',
    });

    await editor.fillPayment({ amount: 10, accountName: 'Current Account' });
    await editor.saveButton().click();
    await expect(editor.successBanner()).toBeVisible({ timeout: 10_000 });
  });

  test('add member to the test group', async ({ adminPage: page }) => {
    await openGroup(page);
    await page.getByRole('tab', { name: /members/i }).first().click();

    // Wait for the member dropdown to load options
    await page.waitForFunction(
      (sel) => {
        const select = document.querySelector(sel);
        return select && select.options.length > 1;
      },
      '#group-add-by-name',
      { timeout: 10_000 },
    );

    // Select the test member from the dropdown — find the exact label text first
    const groupOption = page.locator('#group-add-by-name option').filter({ hasText: MEMBER_SUR });
    const groupLabel = await groupOption.first().textContent();
    await page.locator('#group-add-by-name').selectOption({ label: groupLabel });

    // Click the Add button next to the name dropdown
    const addSection = page.locator('label[for="group-add-by-name"]').locator('..');
    await addSection.locator('..').getByRole('button', { name: 'Add' }).click();

    // Member should appear in the group members table
    await expect(page.getByText(MEMBER_SUR)).toBeVisible({ timeout: 6_000 });
  });
});

// ── EventRecord Navigation & Details ────────────────────────────────────

test.describe('EventRecord navigation and details', () => {
  test('Calendar event link opens EventRecord Details tab', async ({ adminPage: page }) => {
    await gotoEventViaCalendar(page);

    // URL should be /calendar/events/<uuid>
    await expect(page).toHaveURL(/\/calendar\/events\/[^/]+$/);

    // Heading shows event topic
    await expect(page.getByRole('heading', { name: EVENT_TOPIC })).toBeVisible();

    // Details tab is selected by default
    const detailsTab = page.getByRole('tab', { name: /details/i }).first();
    await expect(detailsTab).toHaveAttribute('aria-selected', 'true');
  });

  test('Details tab shows event info', async ({ adminPage: page }) => {
    await gotoEventViaCalendar(page);

    // Date in DD/MM/YYYY format
    await expect(page.getByText('15/06/2026', { exact: true })).toBeVisible();
    // Time
    await expect(page.getByText('10:00', { exact: true })).toBeVisible();
    // Group name as a link
    await expect(page.getByRole('link', { name: GROUP_NAME }).first()).toBeVisible();
    // Topic
    await expect(page.getByRole('paragraph').filter({ hasText: EVENT_TOPIC })).toBeVisible();
  });

  test('all three tabs are visible and clickable', async ({ adminPage: page }) => {
    await gotoEventViaCalendar(page);

    // Details tab
    await expect(page.getByRole('tab', { name: /details/i }).first()).toBeVisible();

    // Members tab — click it
    const membersTab = page.getByRole('tab', { name: /members/i }).first();
    await expect(membersTab).toBeVisible();
    await membersTab.click();
    await expect(membersTab).toHaveAttribute('aria-selected', 'true');

    // Financials tab — click it
    const financialsTab = page.getByRole('tab', { name: /financials/i }).first();
    await expect(financialsTab).toBeVisible();
    await financialsTab.click();
    await expect(financialsTab).toHaveAttribute('aria-selected', 'true');

    // Financials summary card labels visible
    await expect(page.getByText(/income/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/costs/i).first()).toBeVisible();
    await expect(page.getByText(/net balance/i).first()).toBeVisible();
  });
});

// ── Event Members ───────────────────────────────────────────────────────

test.describe('Event Members', () => {
  test('initially shows no members registered', async ({ adminPage: page }) => {
    await gotoEventMembersTab(page);
    await expect(page.getByText(/no members registered/i)).toBeVisible();
  });

  test('add a member by name', async ({ adminPage: page }) => {
    await gotoEventMembersTab(page);

    // Wait for the add-by-name dropdown to load options
    await page.waitForFunction(
      (sel) => {
        const select = document.querySelector(sel);
        return select && select.options.length > 1;
      },
      '#event-add-by-name',
      { timeout: 10_000 },
    );

    // Select the test member — find the exact label text first
    const eventOption = page.locator('#event-add-by-name option').filter({ hasText: MEMBER_SUR });
    const eventLabel = await eventOption.first().textContent();
    await page.locator('#event-add-by-name').selectOption({ label: eventLabel });

    // Click the Add button next to the name dropdown
    const addSection = page.locator('label[for="event-add-by-name"]').locator('..');
    await addSection.locator('..').getByRole('button', { name: 'Add' }).click();

    // Member should appear in the table
    await expect(page.getByRole('link', { name: MEMBER_SUR })).toBeVisible({ timeout: 6_000 });

    // "No members registered" should be gone
    await expect(page.getByText(/no members registered/i)).toBeHidden();
  });

  test('toggle organiser checkbox', async ({ adminPage: page }) => {
    await gotoEventMembersTab(page);

    // Find the member row
    const row = page.getByRole('row').filter({ hasText: MEMBER_SUR });
    await expect(row).toBeVisible({ timeout: 6_000 });

    // The row has two checkboxes: selection (first) and organiser (second)
    const organiserCheckbox = row.locator('input[type="checkbox"]').nth(1);
    await expect(organiserCheckbox).toBeVisible();

    // Initially unchecked
    await expect(organiserCheckbox).not.toBeChecked();

    // Toggle on
    await organiserCheckbox.click();
    await expect(organiserCheckbox).toBeChecked({ timeout: 3_000 });
  });

  test('remove selected member', async ({ adminPage: page }) => {
    await gotoEventMembersTab(page);

    // Find the member row and click the selection checkbox (first checkbox)
    const row = page.getByRole('row').filter({ hasText: MEMBER_SUR });
    await expect(row).toBeVisible({ timeout: 6_000 });
    const selectionCheckbox = row.locator('input[type="checkbox"]').first();
    await selectionCheckbox.click();

    // "Remove selected" link should appear
    const removeBtn = page.getByText(/remove selected/i);
    await expect(removeBtn).toBeVisible();

    // Accept the confirm dialog
    page.once('dialog', (d) => d.accept());
    await removeBtn.click();

    // Member should be gone
    await expect(page.getByText(/no members registered/i)).toBeVisible({ timeout: 6_000 });
  });

  test('copy members from group', async ({ adminPage: page }) => {
    await gotoEventMembersTab(page);

    // Event should have no members now (removed in previous test)
    await expect(page.getByText(/no members registered/i)).toBeVisible();

    // "Copy members from group" button should be visible (this is a group event)
    const copyBtn = page.getByRole('button', { name: /copy members from group/i });
    await expect(copyBtn).toBeVisible();

    // Accept the confirm dialog
    page.once('dialog', (d) => d.accept());
    await copyBtn.click();

    // Member should now appear (copied from the group)
    await expect(page.getByRole('link', { name: MEMBER_SUR })).toBeVisible({ timeout: 6_000 });
  });
});

// ── Event Financials ────────────────────────────────────────────────────

test.describe('Event Financials', () => {
  test('add-transaction link is present', async ({ adminPage: page }) => {
    await gotoEventFinancialsTab(page);

    const addLink = page.getByRole('link', { name: /add transaction for this event/i });
    await expect(addLink).toBeVisible();

    // Link href should contain eventId parameter
    const href = await addLink.getAttribute('href');
    expect(href).toContain('eventId=');
  });

  test('create transaction linked to event and verify in financials', async ({ adminPage: page }) => {
    await gotoEventFinancialsTab(page);

    // Click the "Add transaction" link
    await page.getByRole('link', { name: /add transaction for this event/i }).click();
    await page.getByRole('heading', { name: 'Add Transaction' }).waitFor({ timeout: 10_000 });

    // Fill the transaction form
    const editor = new TransactionEditorPage(page);
    await editor.typeButton('Money received').click();
    await editor.accountSelect().selectOption({ index: 1 });
    await editor.dateInput().fill('15/06/2026');
    await editor.fromToInput().fill(TXN_PAYEE);
    await editor.amountInput().fill('25.00');

    // Category allocation — fill the first available category row
    const catRow = page.getByRole('row').filter({ has: page.locator('input[name="categoryAmount"]') }).first();
    await catRow.locator('input[name="categoryAmount"]').fill('25.00');

    await editor.saveButton().click();
    await expect(editor.successBanner()).toBeVisible({ timeout: 10_000 });

    // Navigate back to the event financials tab
    await gotoEventFinancialsTab(page);

    // The transaction payee should appear in the income section
    await expect(page.getByText(TXN_PAYEE)).toBeVisible({ timeout: 10_000 });

    // Summary card should show £25.00 income
    await expect(page.getByText('£25.00').first()).toBeVisible();
  });
});

// ── Schedule View Link ──────────────────────────────────────────────────

test.describe('Schedule View link', () => {
  test('View link in group schedule opens EventRecord', async ({ adminPage: page }) => {
    await openGroup(page);
    await page.getByRole('tab', { name: /schedule/i }).first().click();

    // Wait for the schedule to load with our event
    await expect(page.getByText(EVENT_TOPIC)).toBeVisible({ timeout: 6_000 });

    // Click the "View" link for the event
    const eventRow = page.getByRole('row').filter({ hasText: EVENT_TOPIC });
    const viewLink = eventRow.getByRole('link', { name: 'View' });
    await expect(viewLink).toBeVisible();
    await viewLink.click();

    // Should navigate to EventRecord
    await expect(page).toHaveURL(/\/calendar\/events\/[^/]+$/);
    await expect(page.getByRole('heading', { name: EVENT_TOPIC })).toBeVisible({ timeout: 10_000 });
  });
});

// ── Cleanup ─────────────────────────────────────────────────────────────

test.describe('Event members cleanup', () => {
  test('delete the test member', async ({ adminPage: page }) => {
    // Search for the member via the member list
    const clicked = await page.evaluate(() => {
      const link = document.querySelector('a[href="/members"]');
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) await page.goto('/members');
    await page.getByRole('heading', { name: 'Members' }).waitFor({ timeout: 10_000 });

    // Search for our test member
    await page.locator('input[name="search"]').fill(MEMBER_SUR);
    await expect(page.getByText(MEMBER_SUR).first()).toBeVisible({ timeout: 6_000 });

    // Click into the member record
    await page.getByRole('link', { name: MEMBER_SUR }).first().click();
    await page.waitForURL(/\/members\/[^/]+$/, { timeout: 10_000 });

    // Delete
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /delete/i }).first().click();
    await page.waitForURL('/members', { timeout: 10_000 });
  });

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
