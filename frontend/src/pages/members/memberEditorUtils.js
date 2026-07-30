// beacon2026/frontend/src/pages/members/memberEditorUtils.js
//
// Pure helpers and constants shared by MemberEditor and its extracted sections.

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export const BLANK_FORM = {
  title: '',
  forenames: '',
  surname: '',
  knownAs: '',
  initials: '',
  suffix: '',
  email: '',
  mobile: '',
  statusId: '',
  classId: '',
  joinedOn: '',
  nextRenewal: '',
  giftAidFrom: '',
  homeU3a: '',
  notes: '',
  hideContact: false,
  emergencyContact: '',
  customField1: '',
  customField2: '',
  customField3: '',
  customField4: '',
  // address
  houseNo: '',
  street: '',
  addLine1: '',
  addLine2: '',
  town: '',
  county: '',
  postcode: '',
  telephone: '',
  // partner
  existingPartnerId: '',
  // payment (new member only)
  payAmount: '',
  payMethod: '',
  payAccountId: '',
  payRef: '',
};

export const TITLES = ['', 'Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Rev', 'Sir', 'Lady'];

/**
 * Compute next renewal date from joined date and year-config settings.
 * Returns an ISO date string (YYYY-MM-DD) or '' if inputs are missing.
 *
 * Formula:
 *   1. Find the next occurrence of (yearStartMonth/yearStartDay) after joinedOn.
 *   2. If extendedMembershipMonth is set and join calendar-month >= that month,
 *      add one extra year (member's first term covers the following year too).
 */
export function computeNextRenewal(joinedOnIso, config) {
  if (!joinedOnIso || !config) return '';
  const { yearStartMonth, yearStartDay, extendedMembershipMonth } = config;
  // Parse in local time to avoid UTC-offset surprises on the date boundary
  const [jy, jm, jd] = joinedOnIso.split('-').map(Number);
  const joinDate = new Date(jy, jm - 1, jd);
  const joinMonth = jm; // calendar month 1-12

  // First occurrence of year-start on or after the join date
  const thisYrStart = new Date(jy, yearStartMonth - 1, yearStartDay);
  let renewalYear = joinDate >= thisYrStart ? jy + 1 : jy;

  // Extended membership: if joined in month >= extendedMembershipMonth, skip one more year
  if (extendedMembershipMonth != null && joinMonth >= extendedMembershipMonth) {
    renewalYear += 1;
  }

  const d = new Date(renewalYear, yearStartMonth - 1, yearStartDay);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
