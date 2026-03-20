// beacon2/backend/src/__tests__/helpers.js
// Shared test utilities.

import { signAccessToken } from '../utils/jwt.js';

// Privilege set that covers all currently-used route guards
export const ALL_PRIVS = [
  'users_list:view',
  'user_record:view', 'user_record:create', 'user_record:change', 'user_record:delete',
  'roles_list:view',
  'role_record:view', 'role_record:create', 'role_record:change', 'role_record:delete',
  'privilege_resources:view',
  'member_classes:view', 'member_classes:create', 'member_classes:change', 'member_classes:delete',
  'member_data_validation:view', 'member_data_validation:change',
  'member_statuses:view', 'member_statuses:create', 'member_statuses:change', 'member_statuses:delete',
  'members_list:view',
  'member_record:view', 'member_record:create', 'member_record:change', 'member_record:delete',
  'groups_list:view',
  'group_records_all:view', 'group_records_all:create', 'group_records_all:change', 'group_records_all:delete',
  'group_faculties:view', 'group_faculties:create', 'group_faculties:change', 'group_faculties:delete',
  'group_venues:view', 'group_venues:create', 'group_venues:change', 'group_venues:delete',
  'group_ledger_all:view', 'group_ledger_all:create', 'group_ledger_all:change', 'group_ledger_all:delete', 'group_ledger_all:download',
  'group_ledger_as_leader:view', 'group_ledger_as_leader:create', 'group_ledger_as_leader:change', 'group_ledger_as_leader:delete', 'group_ledger_as_leader:download',
  'finance_accounts:view', 'finance_accounts:create', 'finance_accounts:change', 'finance_accounts:delete',
  'finance_categories:view', 'finance_categories:create', 'finance_categories:change', 'finance_categories:delete',
  'finance_ledger:view', 'finance_ledger:download',
  'finance_reconcile:view', 'finance_reconcile:reconcile',
  'finance_statement:view', 'finance_statement:download',
  'finance_transactions:view', 'finance_transactions:create', 'finance_transactions:change', 'finance_transactions:delete',
  'finance_transfer_money:view', 'finance_transfer_money:create', 'finance_transfer_money:change', 'finance_transfer_money:delete',
  'group_statement:view', 'group_statement:download',
  'poll_set_up:view', 'poll_set_up:create', 'poll_set_up:change', 'poll_set_up:delete',
  'audit_trail:view', 'audit_trail:delete',
  'offices:view', 'offices:create', 'offices:change', 'offices:delete',
  'members_recent:view', 'members_recent:download',
  'membership_statistics:view', 'membership_statistics:download',
  'membership_renewals:view', 'membership_renewals:renew',
  'members_non_renewals:view', 'members_non_renewals:lapse',
  'settings:view', 'settings:change',
  'data_export_backup:view', 'data_export_backup:download', 'data_export_backup:restore',
  'addresses_export:view', 'addresses_export:download',
  'address_labels:download',
  'email:view', 'email:send',
  'email_delivery:view', 'email_delivery:all',
  'email_standard_messages:view', 'email_standard_messages:create', 'email_standard_messages:change', 'email_standard_messages:delete',
  'email_addresses:download',
  'gift_aid_declaration:view', 'gift_aid_declaration:download_and_mark',
  'finance_batches:view', 'finance_batches:create', 'finance_batches:delete',
  'public_links:view', 'public_links:change',
  'system_messages:view', 'system_messages:change',
  'calendar:view', 'calendar:download',
  'meetings:view', 'meetings:create', 'meetings:change', 'meetings:delete',
];

export const TEST_TENANT = 'test-u3a';
export const TEST_USER_ID = 'user-id-1';

/** Returns a Bearer token string for use in Authorization headers. */
export function makeAuthHeader(overrides = {}) {
  const token = signAccessToken({
    userId: TEST_USER_ID,
    tenantSlug: TEST_TENANT,
    name: 'Test User',
    privileges: ALL_PRIVS,
    ...overrides,
  });
  return `Bearer ${token}`;
}

/** Returns a sysAdmin Bearer token. */
export function makeSysAdminHeader() {
  const token = signAccessToken({ sysAdminId: 'admin-1', isSysAdmin: true, name: 'Admin' });
  return `Bearer ${token}`;
}
