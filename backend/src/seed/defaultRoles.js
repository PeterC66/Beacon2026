// beacon2/backend/src/seed/defaultRoles.js
// Default roles seeded when a new u3a tenant is created.
// Each role lists its default privileges as { code, action } pairs.
// Source of truth: doc 8.4.1 "Privileges Map and default Privileges".
//
// Action key (matches column headers in the doc):
//   v = view    c = create    e = change/edit    d = delete    o = other (varies per resource)

export const DEFAULT_ROLES = [
  {
    name: 'Administration',
    isCommittee: false,
    notes: 'Full administrative access. Assigned to the Site Administrator.',
    defaultPrivileges: [
      // Address
      { code: 'address_labels',            action: 'view' },
      { code: 'address_labels',            action: 'download' },          // vo
      { code: 'addresses_export',          action: 'view' },
      { code: 'addresses_export',          action: 'download' },          // vo

      // Audit
      { code: 'audit_detail',             action: 'view' },               // v
      { code: 'audit_trail',              action: 'view' },
      { code: 'audit_trail',              action: 'delete' },             // vd

      // Calendar / data
      { code: 'calendar',                 action: 'view' },
      { code: 'calendar',                 action: 'download' },           // vo
      { code: 'data_export_backup',       action: 'view' },
      { code: 'data_export_backup',       action: 'download' },           // vo

      // Email
      { code: 'email',                    action: 'view' },
      { code: 'email',                    action: 'send' },               // vo
      { code: 'email_addresses',          action: 'download' },           // o
      { code: 'email_delivery',           action: 'view' },
      { code: 'email_delivery',           action: 'all' },               // vo (all = view all)
      { code: 'email_standard_messages',  action: 'view' },
      { code: 'email_standard_messages',  action: 'create' },
      { code: 'email_standard_messages',  action: 'change' },
      { code: 'email_standard_messages',  action: 'delete' },            // vced

      // Finance
      { code: 'finance_accounts',         action: 'view' },
      { code: 'finance_accounts',         action: 'create' },
      { code: 'finance_accounts',         action: 'change' },
      { code: 'finance_accounts',         action: 'delete' },            // vced
      { code: 'finance_batches',          action: 'view' },
      { code: 'finance_batches',          action: 'create' },
      { code: 'finance_batches',          action: 'delete' },            // vcd (no edit)
      { code: 'finance_categories',       action: 'view' },
      { code: 'finance_categories',       action: 'create' },
      { code: 'finance_categories',       action: 'change' },
      { code: 'finance_categories',       action: 'delete' },            // vced
      { code: 'finance_ledger',           action: 'view' },
      { code: 'finance_ledger',           action: 'download' },          // vo
      { code: 'finance_reconcile',        action: 'view' },
      { code: 'finance_reconcile',        action: 'reconcile' },         // vo
      { code: 'finance_statement',        action: 'view' },
      { code: 'finance_statement',        action: 'download' },          // vo
      { code: 'finance_transactions',     action: 'view' },
      { code: 'finance_transactions',     action: 'create' },
      { code: 'finance_transactions',     action: 'change' },
      { code: 'finance_transactions',     action: 'delete' },            // vced
      { code: 'finance_transfer_money',   action: 'view' },
      { code: 'finance_transfer_money',   action: 'create' },
      { code: 'finance_transfer_money',   action: 'change' },
      { code: 'finance_transfer_money',   action: 'delete' },            // vced

      // Gift Aid
      { code: 'gift_aid_declaration',     action: 'view' },
      { code: 'gift_aid_declaration',     action: 'download_and_mark' }, // vo

      // Groups
      { code: 'group_faculties',          action: 'view' },
      { code: 'group_faculties',          action: 'create' },
      { code: 'group_faculties',          action: 'change' },
      { code: 'group_faculties',          action: 'delete' },            // vced
      { code: 'group_leaders',            action: 'view' },
      { code: 'group_leaders',            action: 'email_labels' },      // vo
      { code: 'group_ledger_all',         action: 'view' },
      { code: 'group_ledger_all',         action: 'create' },
      { code: 'group_ledger_all',         action: 'change' },
      { code: 'group_ledger_all',         action: 'delete' },
      { code: 'group_ledger_all',         action: 'download' },          // vcedo
      { code: 'group_ledger_as_leader',   action: 'view' },
      { code: 'group_ledger_as_leader',   action: 'create' },
      { code: 'group_ledger_as_leader',   action: 'change' },
      { code: 'group_ledger_as_leader',   action: 'delete' },
      { code: 'group_ledger_as_leader',   action: 'download' },          // vcedo
      { code: 'group_records_all',        action: 'view' },
      { code: 'group_records_all',        action: 'create' },
      { code: 'group_records_all',        action: 'change' },
      { code: 'group_records_all',        action: 'delete' },
      { code: 'group_records_all',        action: 'download_members' },  // vcedo
      { code: 'group_records_as_leader',  action: 'view' },
      { code: 'group_records_as_leader',  action: 'change' },
      { code: 'group_records_as_leader',  action: 'delete' },
      { code: 'group_records_as_leader',  action: 'download_members' },  // vedo
      { code: 'group_records_as_member',  action: 'view' },
      { code: 'group_records_as_member',  action: 'change' },            // ve
      { code: 'group_statement',          action: 'view' },
      { code: 'group_statement',          action: 'download' },          // vo
      { code: 'group_venues',             action: 'view' },
      { code: 'group_venues',             action: 'create' },
      { code: 'group_venues',             action: 'change' },
      { code: 'group_venues',             action: 'delete' },            // vced
      { code: 'groups_list',              action: 'view' },              // v only
      { code: 'groups_add_by_name',       action: 'change' },            // e
      { code: 'groups_add_by_name_leader', action: 'change' },           // e
      { code: 'groups_add_by_no',         action: 'change' },            // e
      { code: 'groups_add_by_no_leader',  action: 'change' },            // e

      // Letters
      { code: 'letters',                  action: 'view' },
      { code: 'letters',                  action: 'download' },          // vo
      { code: 'letters_standard_messages', action: 'view' },
      { code: 'letters_standard_messages', action: 'create' },
      { code: 'letters_standard_messages', action: 'change' },
      { code: 'letters_standard_messages', action: 'delete' },           // vced

      // Meetings
      { code: 'meetings',                 action: 'view' },
      { code: 'meetings',                 action: 'create' },
      { code: 'meetings',                 action: 'change' },
      { code: 'meetings',                 action: 'delete' },            // vced

      // Members
      { code: 'member_classes',           action: 'view' },
      { code: 'member_classes',           action: 'create' },
      { code: 'member_classes',           action: 'change' },
      { code: 'member_classes',           action: 'delete' },            // vced
      { code: 'member_record',            action: 'view' },
      { code: 'member_record',            action: 'create' },
      { code: 'member_record',            action: 'change' },
      { code: 'member_record',            action: 'delete' },            // vced
      { code: 'member_statuses',          action: 'view' },
      { code: 'member_statuses',          action: 'create' },
      { code: 'member_statuses',          action: 'change' },
      { code: 'member_statuses',          action: 'delete' },            // vced
      { code: 'members_list',             action: 'view' },
      { code: 'members_list',             action: 'download' },          // vo
      { code: 'members_delete_expired',   action: 'view' },
      { code: 'members_delete_expired',   action: 'delete' },            // vd
      { code: 'members_non_renewals',     action: 'view' },
      { code: 'members_non_renewals',     action: 'lapse' },             // vo
      { code: 'members_recent',           action: 'view' },
      { code: 'members_recent',           action: 'download' },          // vo
      { code: 'membership_cards',         action: 'view' },
      { code: 'membership_cards',         action: 'download_and_mark' }, // vo
      { code: 'membership_renewals',      action: 'view' },
      { code: 'membership_renewals',      action: 'renew' },             // vo
      { code: 'membership_statistics',    action: 'view' },
      { code: 'membership_statistics',    action: 'download' },          // vo

      // Offices / Poll / Links
      { code: 'offices',                  action: 'view' },
      { code: 'offices',                  action: 'create' },
      { code: 'offices',                  action: 'change' },
      { code: 'offices',                  action: 'delete' },            // vced
      { code: 'poll_set_up',              action: 'view' },
      { code: 'poll_set_up',              action: 'create' },
      { code: 'poll_set_up',              action: 'change' },
      { code: 'poll_set_up',              action: 'delete' },            // vced
      { code: 'public_links',             action: 'view' },              // v

      // Roles
      { code: 'role_record',              action: 'view' },
      { code: 'role_record',              action: 'create' },
      { code: 'role_record',              action: 'change' },
      { code: 'role_record',              action: 'delete' },            // vced
      { code: 'roles_list',               action: 'view' },              // v

      // Settings / System
      { code: 'settings',                 action: 'view' },
      { code: 'settings',                 action: 'change' },            // ve
      { code: 'system_messages',          action: 'view' },
      { code: 'system_messages',          action: 'change' },            // ve (no create — system messages are pre-defined)

      // Users
      { code: 'user_record',              action: 'view' },
      { code: 'user_record',              action: 'create' },
      { code: 'user_record',              action: 'change' },
      { code: 'user_record',              action: 'delete' },            // vced
      { code: 'users_list',               action: 'view' },              // v
    ],
  },

  {
    name: 'Group Leaders',
    isCommittee: false,
    notes: 'Access scoped to groups the user leads.',
    defaultPrivileges: [
      // Calendar
      { code: 'calendar',                  action: 'view' },
      { code: 'calendar',                  action: 'download' },          // vo

      // Email
      { code: 'email',                     action: 'view' },
      { code: 'email',                     action: 'send' },              // vo

      // Groups
      { code: 'group_faculties',           action: 'view' },              // v
      { code: 'group_leaders',             action: 'view' },
      { code: 'group_leaders',             action: 'email_labels' },      // vo
      { code: 'group_ledger_as_leader',    action: 'view' },
      { code: 'group_ledger_as_leader',    action: 'create' },
      { code: 'group_ledger_as_leader',    action: 'change' },
      { code: 'group_ledger_as_leader',    action: 'delete' },            // vced (no download)
      { code: 'group_records_as_leader',   action: 'view' },
      { code: 'group_records_as_leader',   action: 'change' },
      { code: 'group_records_as_leader',   action: 'delete' },
      { code: 'group_records_as_leader',   action: 'download_members' },  // vedo
      { code: 'groups_list',               action: 'view' },              // v
      { code: 'groups_add_by_name_leader', action: 'change' },            // e
      { code: 'groups_add_by_no_leader',   action: 'change' },            // e

      // Meetings
      { code: 'meetings',                  action: 'view' },
      { code: 'meetings',                  action: 'create' },            // vc
    ],
  },

  {
    name: 'Groups Coordinator',
    isCommittee: false,
    notes: 'Coordinates across all groups.',
    defaultPrivileges: [
      // Calendar
      { code: 'calendar',                 action: 'view' },
      { code: 'calendar',                 action: 'download' },           // vo

      // Email
      { code: 'email',                    action: 'view' },
      { code: 'email',                    action: 'send' },               // vo

      // Groups
      { code: 'group_faculties',          action: 'view' },
      { code: 'group_faculties',          action: 'create' },
      { code: 'group_faculties',          action: 'change' },
      { code: 'group_faculties',          action: 'delete' },             // vced
      { code: 'group_leaders',            action: 'view' },
      { code: 'group_leaders',            action: 'email_labels' },       // vo
      { code: 'group_ledger_all',         action: 'view' },
      { code: 'group_ledger_all',         action: 'create' },
      { code: 'group_ledger_all',         action: 'change' },
      { code: 'group_ledger_all',         action: 'delete' },             // vced (no download)
      { code: 'group_records_all',        action: 'view' },
      { code: 'group_records_all',        action: 'create' },
      { code: 'group_records_all',        action: 'change' },
      { code: 'group_records_all',        action: 'delete' },
      { code: 'group_records_all',        action: 'download_members' },   // vcedo
      { code: 'group_venues',             action: 'view' },
      { code: 'group_venues',             action: 'create' },
      { code: 'group_venues',             action: 'change' },
      { code: 'group_venues',             action: 'delete' },             // vced
      { code: 'groups_list',              action: 'view' },               // v only
      { code: 'groups_add_by_name',       action: 'change' },             // e
      { code: 'groups_add_by_no',         action: 'change' },             // e

      // Meetings
      { code: 'meetings',                 action: 'view' },
      { code: 'meetings',                 action: 'create' },
      { code: 'meetings',                 action: 'change' },
      { code: 'meetings',                 action: 'delete' },             // vced
    ],
  },

  {
    name: 'Membership Secretary',
    isCommittee: true,
    notes: 'Manages member records, renewals and communications.',
    defaultPrivileges: [
      // Address
      { code: 'address_labels',           action: 'view' },
      { code: 'address_labels',           action: 'download' },           // vo
      { code: 'addresses_export',         action: 'view' },
      { code: 'addresses_export',         action: 'download' },           // vo

      // Email
      { code: 'email',                    action: 'view' },
      { code: 'email',                    action: 'send' },               // vo
      { code: 'email_standard_messages',  action: 'view' },
      { code: 'email_standard_messages',  action: 'create' },
      { code: 'email_standard_messages',  action: 'change' },
      { code: 'email_standard_messages',  action: 'delete' },             // vced

      // Gift Aid
      { code: 'gift_aid_declaration',     action: 'view' },
      { code: 'gift_aid_declaration',     action: 'download_and_mark' },  // vo

      // Members
      { code: 'member_classes',           action: 'view' },
      { code: 'member_classes',           action: 'create' },
      { code: 'member_classes',           action: 'change' },
      { code: 'member_classes',           action: 'delete' },             // vced
      { code: 'member_record',            action: 'view' },
      { code: 'member_record',            action: 'create' },
      { code: 'member_record',            action: 'change' },
      { code: 'member_record',            action: 'delete' },             // vced
      { code: 'member_statuses',          action: 'view' },
      { code: 'member_statuses',          action: 'create' },
      { code: 'member_statuses',          action: 'change' },
      { code: 'member_statuses',          action: 'delete' },             // vced
      { code: 'members_list',             action: 'view' },
      { code: 'members_list',             action: 'download' },           // vo
      { code: 'members_delete_expired',   action: 'view' },
      { code: 'members_delete_expired',   action: 'delete' },             // vd
      { code: 'members_non_renewals',     action: 'view' },
      { code: 'members_non_renewals',     action: 'lapse' },              // vo
      { code: 'members_recent',           action: 'view' },
      { code: 'members_recent',           action: 'download' },           // vo
      { code: 'membership_cards',         action: 'view' },
      { code: 'membership_cards',         action: 'download_and_mark' },  // vo
      { code: 'membership_renewals',      action: 'view' },
      { code: 'membership_renewals',      action: 'renew' },              // vo
      { code: 'membership_statistics',    action: 'view' },
      { code: 'membership_statistics',    action: 'download' },           // vo

      // Poll
      { code: 'poll_set_up',              action: 'view' },
      { code: 'poll_set_up',              action: 'create' },
      { code: 'poll_set_up',              action: 'change' },
      { code: 'poll_set_up',              action: 'delete' },             // vced
    ],
  },

  {
    name: 'Treasurer',
    isCommittee: true,
    notes: 'Manages financial records and accounts.',
    defaultPrivileges: [
      // Email
      { code: 'email',                    action: 'view' },
      { code: 'email',                    action: 'send' },               // vo

      // Finance
      { code: 'finance_accounts',         action: 'view' },
      { code: 'finance_accounts',         action: 'create' },
      { code: 'finance_accounts',         action: 'change' },
      { code: 'finance_accounts',         action: 'delete' },             // vced
      { code: 'finance_batches',          action: 'view' },
      { code: 'finance_batches',          action: 'create' },
      { code: 'finance_batches',          action: 'delete' },             // vcd (no edit)
      { code: 'finance_categories',       action: 'view' },
      { code: 'finance_categories',       action: 'create' },
      { code: 'finance_categories',       action: 'change' },
      { code: 'finance_categories',       action: 'delete' },             // vced
      { code: 'finance_ledger',           action: 'view' },
      { code: 'finance_ledger',           action: 'download' },           // vo
      { code: 'finance_reconcile',        action: 'view' },
      { code: 'finance_reconcile',        action: 'reconcile' },          // vo
      { code: 'finance_statement',        action: 'view' },
      { code: 'finance_statement',        action: 'download' },           // vo
      { code: 'finance_transactions',     action: 'view' },
      { code: 'finance_transactions',     action: 'create' },
      { code: 'finance_transactions',     action: 'change' },
      { code: 'finance_transactions',     action: 'delete' },             // vced
      { code: 'finance_transfer_money',   action: 'view' },
      { code: 'finance_transfer_money',   action: 'create' },
      { code: 'finance_transfer_money',   action: 'change' },
      { code: 'finance_transfer_money',   action: 'delete' },             // vced

      // Gift Aid
      { code: 'gift_aid_declaration',     action: 'view' },
      { code: 'gift_aid_declaration',     action: 'download_and_mark' },  // vo
    ],
  },
];
