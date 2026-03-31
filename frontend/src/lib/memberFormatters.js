// Shared formatting helpers for member data display

/**
 * Short address: "house_no street, town, postcode"
 * Joins only non-empty parts with ", ".
 */
export function formatShortAddress(member) {
  const houseLine = [member.house_no, member.street].filter(Boolean).join(' ');
  return [houseLine, member.town, member.postcode].filter(Boolean).join(', ');
}

/**
 * Phone: returns mobile if available, otherwise telephone.
 */
export function formatPhone(member) {
  return member.mobile || member.telephone || '';
}

/**
 * True when the member's next_renewal date is in the past (subscription overdue).
 */
export function isSubscriptionOverdue(member) {
  if (!member.next_renewal) return false;
  const renewal = String(member.next_renewal).slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return renewal < today;
}
