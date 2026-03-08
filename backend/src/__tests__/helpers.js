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
  'member_statuses:view', 'member_statuses:create', 'member_statuses:change', 'member_statuses:delete',
  'members_list:view',
  'member_record:view', 'member_record:create', 'member_record:change', 'member_record:delete',
  'groups_list:view',
  'group_records_all:view', 'group_records_all:create', 'group_records_all:change', 'group_records_all:delete',
  'group_faculties:view', 'group_faculties:create', 'group_faculties:change', 'group_faculties:delete',
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
