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
