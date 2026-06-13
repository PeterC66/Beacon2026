// beacon2/frontend/src/pages/members/memberListConstants.js
//
// Static constants shared by MemberList and its extracted sections.

export const DOWNLOAD_FIELDS = [
  { key: 'membership_number', label: 'Membership No', default: true },
  { key: 'title', label: 'Title', default: false },
  { key: 'forenames', label: 'Forenames', default: true },
  { key: 'known_as', label: 'Known As', default: false },
  { key: 'surname', label: 'Surname', default: true },
  { key: 'email', label: 'Email', default: true },
  { key: 'mobile', label: 'Mobile', default: true },
  { key: 'telephone', label: 'Telephone', default: false },
  { key: 'address', label: 'Address', default: false },
  { key: 'town', label: 'Town', default: true },
  { key: 'county', label: 'County', default: false },
  { key: 'postcode', label: 'Postcode', default: true },
  { key: 'country', label: 'Country', default: false },
  { key: 'status', label: 'Status', default: true },
  { key: 'class', label: 'Class', default: true },
  { key: 'joined_on', label: 'Joined', default: false },
  { key: 'next_renewal', label: 'Next Renewal', default: false },
  { key: 'custom_field_1', label: 'Custom Field 1', default: false },
  { key: 'custom_field_2', label: 'Custom Field 2', default: false },
  { key: 'custom_field_3', label: 'Custom Field 3', default: false },
  { key: 'custom_field_4', label: 'Custom Field 4', default: false },
];

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
