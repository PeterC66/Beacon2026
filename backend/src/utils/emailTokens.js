// beacon2/backend/src/utils/emailTokens.js
// Resolves email tokens for a given member record.
// Token names are case-insensitive (we normalise to uppercase before matching).

/**
 * Build a vertical address string from an address object.
 * Lines are separated by \n.
 */
function buildAddressV(addr) {
  if (!addr) return '';
  const parts = [
    addr.house_no,
    addr.street,
    addr.add_line1,
    addr.add_line2,
    addr.town,
    addr.county,
    addr.postcode,
  ].filter(Boolean);
  return parts.join('\n');
}

/**
 * Format a date value (ISO string or Date) as DD/MM/YYYY.
 */
function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  if (!y || !m || !day) return '';
  return `${day}/${m}/${y}`;
}

/**
 * Get a member's familiar name: known_as if set, else first word of forenames.
 */
function famName(m) {
  if (!m) return '';
  if (m.known_as) return m.known_as;
  return (m.forenames || '').split(' ')[0] || '';
}

/**
 * Build a token-to-value map for a member.
 * @param {object} member - member row with optional .address and .partner sub-objects
 * @param {string} u3aName - tenant display name
 */
function buildTokenMap(member, u3aName) {
  const m = member || {};
  const addr = m.address || {};
  const partner = m.partner || null;
  const pAddr = partner?.address || {};

  return {
    '#FAM':         famName(m),
    '#FORENAME':    m.forenames || '',
    '#SURNAME':     m.surname   || '',
    '#TITLE':       m.title     || '',
    '#MEMNO':       m.membership_number != null ? String(m.membership_number) : '',
    '#U3ANAME':     u3aName || '',
    '#EMAIL':       m.email     || '',
    '#TELEPHONE':   addr.telephone || '',
    '#MOBILE':      m.mobile    || '',
    '#ADDRESSV':    buildAddressV(addr),
    '#RENEW':       fmtDate(m.next_renewal),
    '#MEMCLASS':    m.class_name || '',
    '#AFFILIATION': m.home_u3a  || '',
    '#EMERGENCY':   '',   // not yet in Beacon2 schema

    // Partner tokens
    '#PFAM':        famName(partner),
    '#PFORENAME':   partner?.forenames || '',
    '#PSURNAME':    partner?.surname   || '',
    '#PTITLE':      partner?.title     || '',
    '#PEMAIL':      partner?.email     || '',
    '#PTELEPHONE':  pAddr.telephone    || '',
    '#PMOBILE':     partner?.mobile    || '',
  };
}

/**
 * Replace all tokens in `text` using the token map.
 * Tokens are case-insensitive.
 */
function applyTokens(text, tokenMap) {
  if (!text) return '';
  // Build a regex that matches any token key (case-insensitive)
  const keys = Object.keys(tokenMap);
  if (keys.length === 0) return text;
  // Escape # for regex, sort longest-first to avoid partial matches
  const pattern = keys
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace('#', '\\#'))
    .join('|');
  return text.replace(new RegExp(pattern, 'gi'), (match) => {
    const key = match.toUpperCase();
    return tokenMap[key] ?? match;
  });
}

/**
 * Resolve all tokens in subject and body for a single member.
 * Returns { subject, body } with tokens replaced.
 * @param {object} [extraTokens] - optional extra token map (e.g. Gift Aid tokens)
 */
export function resolveTokens(subject, body, member, u3aName, extraTokens) {
  const map = { ...buildTokenMap(member, u3aName), ...extraTokens };
  return {
    subject: applyTokens(subject, map),
    body:    applyTokens(body,    map),
  };
}

/**
 * Format a date for display (exported for reuse).
 */
export { fmtDate };
