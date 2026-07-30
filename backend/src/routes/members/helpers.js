// beacon2026/backend/src/routes/members/helpers.js
// Shared helpers used across the member sub-route files.

import { tenantQuery } from '../../utils/db.js';
import { isFeatureEnabled } from '../../middleware/requireFeature.js';

/** Look up the Gift Aid eligible amount for a member at a given date.
 *  Returns null if GA is not enabled, member has no GA declaration, or no GA fee configured.
 */
export async function resolveGiftAidAmount(slug, memberId, classId, transactionDate) {
  // Check if GA feature is enabled
  if (!(await isFeatureEnabled(slug, 'giftAid'))) return null;

  const [settings] = await tenantQuery(
    slug,
    `SELECT fee_variation FROM tenant_settings WHERE id = 'singleton'`,
  );

  // Check if member has a GA declaration at or before the transaction date
  const [m] = await tenantQuery(slug, `SELECT gift_aid_from FROM members WHERE id = $1`, [
    memberId,
  ]);
  if (!m?.gift_aid_from) return null;
  const gaFrom = String(m.gift_aid_from).slice(0, 10);
  const txDate = String(transactionDate).slice(0, 10);
  if (gaFrom > txDate) return null;

  // Look up the GA fee from the class
  if (settings.fee_variation === 'varies_by_month') {
    // Month-specific: find the fee for the transaction month
    const txMonth = new Date(txDate).getMonth() + 1; // 1-12
    const [monthFee] = await tenantQuery(
      slug,
      `SELECT gift_aid_fee::float FROM class_monthly_fees WHERE class_id = $1 AND month_index = $2`,
      [classId, txMonth],
    );
    return monthFee?.gift_aid_fee ?? null;
  }

  // Standard: use the class-level gift_aid_fee
  const [cls] = await tenantQuery(
    slug,
    `SELECT gift_aid_fee::float FROM member_classes WHERE id = $1`,
    [classId],
  );
  return cls?.gift_aid_fee ?? null;
}

/** Derive initials from a forenames string: "William John" → "WJ" */
export function deriveInitials(forenames) {
  return (forenames ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .join('');
}
