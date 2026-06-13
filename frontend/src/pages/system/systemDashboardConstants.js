// beacon2/frontend/src/pages/system/systemDashboardConstants.js
//
// Constants and a small helper shared by SystemDashboard and its extracted
// sections.

export const EMPTY_FORM = {
  name: '',
  slug: '',
  adminEmail: '',
  adminName: '',
  adminPassword: '',
  adminUsername: '',
};

// ─── Feature toggle definitions (same structure as FeatureConfig.jsx) ────────
export const SECTIONS = [
  {
    title: 'Membership',
    master: null,
    toggles: [
      { key: 'membershipCards', label: 'Membership Cards', defaultValue: true },
      { key: 'membershipRenewals', label: 'Membership Renewals', defaultValue: true },
      { key: 'addressesExport', label: 'Addresses Export', defaultValue: true },
      { key: 'giftAid', label: 'Gift Aid', defaultValue: false },
      { key: 'customFields', label: 'Custom Fields', defaultValue: true },
      { key: 'polls', label: 'Polls', defaultValue: true },
      { key: 'statistics', label: 'Membership Statistics', defaultValue: true },
    ],
  },
  {
    title: 'Groups',
    master: { key: 'groups', label: 'Groups module', defaultValue: true },
    toggles: [
      { key: 'teams', label: 'Teams', defaultValue: true, dependsOn: 'groups' },
      { key: 'venues', label: 'Venues', defaultValue: true, dependsOn: 'groups' },
      { key: 'faculties', label: 'Faculties', defaultValue: true, dependsOn: 'groups' },
      { key: 'groupLedger', label: 'Group Ledger', defaultValue: false, dependsOn: 'groups' },
      { key: 'siteworks', label: 'SiteWorks', defaultValue: false, dependsOn: 'groups' },
    ],
  },
  {
    title: 'Events & Calendar',
    master: { key: 'events', label: 'Events & Calendar module', defaultValue: true },
    toggles: [
      { key: 'calendar', label: 'Calendar', defaultValue: true, dependsOn: 'events' },
      { key: 'eventTypes', label: 'Event Types', defaultValue: true, dependsOn: 'events' },
    ],
  },
  {
    title: 'Finance',
    master: { key: 'finance', label: 'Finance module', defaultValue: true },
    toggles: [
      { key: 'creditBatches', label: 'Credit Batches', defaultValue: true, dependsOn: 'finance' },
      { key: 'reconciliation', label: 'Reconciliation', defaultValue: true, dependsOn: 'finance' },
      {
        key: 'financialStatement',
        label: 'Financial Statement',
        defaultValue: true,
        dependsOn: 'finance',
      },
      {
        key: 'groupsStatement',
        label: 'Groups Statement',
        defaultValue: true,
        dependsOn: 'finance',
      },
      { key: 'transferMoney', label: 'Transfer Money', defaultValue: true, dependsOn: 'finance' },
    ],
  },
  {
    title: 'Email & Letters',
    master: { key: 'email', label: 'Email & Letters module', defaultValue: true },
    toggles: [],
  },
  {
    title: 'Members Portal',
    master: { key: 'portal', label: 'Members Portal', defaultValue: true },
    toggles: [],
  },
  {
    title: 'Online Joining',
    master: { key: 'onlineJoining', label: 'Online Joining', defaultValue: true },
    toggles: [],
  },
];

export function getVal(config, key, defaultValue) {
  if (key in config) return config[key];
  return defaultValue;
}
