// beacon2026/backend/src/routes/members/lifecycle.js
// Membership lifecycle: renewals, renew, non-renewals, and lapse.

import { Router } from 'express';
import { z } from 'zod';
import { requirePrivilege } from '../../middleware/requirePrivilege.js';
import { requireFeature } from '../../middleware/requireFeature.js';
import { tenantQuery } from '../../utils/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../utils/audit.js';
import { resolveGiftAidAmount } from './helpers.js';

const router = Router();

// ─── GET /members/renewals ────────────────────────────────────────────────
// Lists Current and Lapsed members with fee info for the renewals screen.
// Also returns year boundaries so the client can filter by period.

router.get(
  '/renewals',
  requireFeature('membershipRenewals'),
  requirePrivilege('membership_renewals', 'view'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;

      const [cfg] = await tenantQuery(
        slug,
        `SELECT year_start_month, year_start_day, advance_renewals_weeks
       FROM tenant_settings WHERE id = 'singleton'`,
      );
      const ysm = cfg?.year_start_month ?? 1;
      const ysd = cfg?.year_start_day ?? 1;
      const advW = cfg?.advance_renewals_weeks ?? 4;

      const now = new Date();
      const yr = now.getFullYear();
      const candidateStart = new Date(yr, ysm - 1, ysd);
      const yearStart = candidateStart <= now ? candidateStart : new Date(yr - 1, ysm - 1, ysd);

      const prevYearStart = new Date(yearStart);
      prevYearStart.setFullYear(prevYearStart.getFullYear() - 1);

      const nextYearStart = new Date(yearStart);
      nextYearStart.setFullYear(nextYearStart.getFullYear() + 1);

      // "Next year" tab only visible within advance_renewals_weeks before nextYearStart
      const advanceStart = new Date(nextYearStart);
      advanceStart.setDate(advanceStart.getDate() - advW * 7);
      const showNextYear = now >= advanceStart;

      const rows = await tenantQuery(
        slug,
        `SELECT m.id, m.membership_number, m.forenames, m.surname, m.known_as,
              ms.id   AS status_id, ms.name AS status_name,
              mc.id   AS class_id,  mc.name AS class_name,
              mc.fee, mc.gift_aid_fee,
              m.next_renewal, m.gift_aid_from, m.partner_id, m.email,
              m.portal_password_hash IS NOT NULL AS has_portal_password,
              m.portal_email_verified,
              p.forenames AS partner_forenames, p.surname AS partner_surname
       FROM members m
       LEFT JOIN member_statuses ms ON ms.id = m.status_id
       LEFT JOIN member_classes  mc ON mc.id = m.class_id
       LEFT JOIN members          p ON p.id  = m.partner_id
       WHERE ms.name ILIKE '%Current%' OR ms.name ILIKE '%Lapsed%'
       ORDER BY m.surname, m.forenames`,
      );

      res.json({
        members: rows,
        yearStart: yearStart.toISOString().slice(0, 10),
        prevYearStart: prevYearStart.toISOString().slice(0, 10),
        nextYearStart: nextYearStart.toISOString().slice(0, 10),
        showNextYear,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /members/renew ──────────────────────────────────────────────────
// Bulk-renews the given members: advances next_renewal by 1 year, sets
// status to Current if Lapsed, creates a finance transaction for each.

const renewSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1),
  accountId: z.string().min(1),
  paymentMethod: z.string().min(1),
  amounts: z.record(z.string(), z.number().positive()),
  giftAidChanges: z.record(z.string(), z.boolean()).optional(),
  yearStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.post(
  '/renew',
  requireFeature('membershipRenewals'),
  requirePrivilege('membership_renewals', 'renew'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const data = renewSchema.parse(req.body);

      // Find the "Current" status id to upgrade Lapsed members
      const [currentStatus] = await tenantQuery(
        slug,
        `SELECT id FROM member_statuses WHERE name ILIKE '%Current%' ORDER BY name LIMIT 1`,
      );
      if (!currentStatus) throw new AppError('No "Current" member status found.', 400);

      const renewed = [];
      const errors = [];

      for (const memberId of data.memberIds) {
        try {
          // Fetch member to get current next_renewal and status
          const [m] = await tenantQuery(
            slug,
            `SELECT m.id, m.forenames, m.surname, m.next_renewal, m.status_id,
                  ms.name AS status_name, m.gift_aid_from, m.class_id
           FROM members m
           LEFT JOIN member_statuses ms ON ms.id = m.status_id
           WHERE m.id = $1`,
            [memberId],
          );
          if (!m) {
            errors.push({ memberId, error: 'Member not found' });
            continue;
          }

          // New next_renewal = current next_renewal + 1 year (or yearStart + 1 year if null)
          const base = m.next_renewal ? String(m.next_renewal).slice(0, 10) : data.yearStart;
          const baseDate = new Date(base);
          baseDate.setFullYear(baseDate.getFullYear() + 1);
          const newNextRenewal = baseDate.toISOString().slice(0, 10);

          // Should we set to Current?
          const isLapsed = (m.status_name ?? '').toLowerCase().includes('lapsed');
          const newStatusId = isLapsed ? currentStatus.id : m.status_id;

          // Gift Aid update
          const gaChange = data.giftAidChanges?.[memberId];
          let giftAidFrom;
          if (gaChange === true && !m.gift_aid_from) {
            giftAidFrom = 'TODAY';
          } else if (gaChange === false) {
            giftAidFrom = null;
          } else {
            giftAidFrom = m.gift_aid_from ? String(m.gift_aid_from).slice(0, 10) : null;
          }

          // Update member record
          await tenantQuery(
            slug,
            `UPDATE members
           SET next_renewal  = $1::date,
               status_id     = $2,
               gift_aid_from = $3::date,
               card_printed  = false,
               updated_at    = now()
           WHERE id = $4`,
            [
              newNextRenewal,
              newStatusId,
              giftAidFrom === 'TODAY' ? new Date().toISOString().slice(0, 10) : giftAidFrom,
              memberId,
            ],
          );

          // Create finance transaction (no category splits — user can categorize via ledger)
          const amount = data.amounts[memberId];
          const fromTo = `${m.forenames} ${m.surname}`;

          // Resolve Gift Aid eligible amount (uses the member's gift_aid_from after any update above)
          const effectiveGaFrom =
            giftAidFrom === 'TODAY' ? new Date().toISOString().slice(0, 10) : giftAidFrom;
          let gaAmount = null;
          if (effectiveGaFrom && m.class_id) {
            gaAmount = await resolveGiftAidAmount(
              slug,
              memberId,
              m.class_id,
              new Date().toISOString().slice(0, 10),
            );
          }

          const [txn] = await tenantQuery(
            slug,
            `INSERT INTO transactions
             (account_id, date, type, from_to, amount, payment_method, detail, member_id_1, gift_aid_amount)
           VALUES ($1, CURRENT_DATE, 'in', $2, $3::numeric, $4, 'Membership', $5, $6::numeric)
           RETURNING id, transaction_number`,
            [data.accountId, fromTo, amount, data.paymentMethod, memberId, gaAmount],
          );

          logAudit(slug, {
            userId: req.user.userId,
            userName: req.user.name,
            action: 'renew',
            entityType: 'member',
            entityId: memberId,
            detail: JSON.stringify({ newNextRenewal }),
          });

          // Gift Aid consent audit
          if (gaChange === true && !m.gift_aid_from) {
            logAudit(slug, {
              userId: req.user.userId,
              userName: req.user.name,
              action: 'gift_aid_consent',
              entityType: 'member',
              entityId: memberId,
              entityName: `${m.forenames} ${m.surname}`,
              detail: JSON.stringify({ giftAidFrom: new Date().toISOString().slice(0, 10) }),
            });
          } else if (gaChange === false && m.gift_aid_from) {
            logAudit(slug, {
              userId: req.user.userId,
              userName: req.user.name,
              action: 'gift_aid_withdrawn',
              entityType: 'member',
              entityId: memberId,
              entityName: `${m.forenames} ${m.surname}`,
              detail: JSON.stringify({ previousGiftAidFrom: String(m.gift_aid_from).slice(0, 10) }),
            });
          }

          renewed.push({ memberId, newNextRenewal, transactionNumber: txn.transaction_number });
        } catch (err) {
          errors.push({ memberId, error: err.message });
        }
      }

      res.json({ renewed, errors });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /members/non-renewals ────────────────────────────────────────────
// mode=this_year  — Current members whose next_renewal < current year start
// mode=long_term  — All members whose next_renewal is older than deletion_years

router.get(
  '/non-renewals',
  requireFeature('membershipRenewals'),
  requirePrivilege('members_non_renewals', 'view'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const mode = req.query.mode === 'long_term' ? 'long_term' : 'this_year';

      const [cfg] = await tenantQuery(
        slug,
        `SELECT year_start_month, year_start_day, grace_lapse_weeks, deletion_years
       FROM tenant_settings WHERE id = 'singleton'`,
      );
      const ysm = cfg?.year_start_month ?? 1;
      const ysd = cfg?.year_start_day ?? 1;
      const graceLapse = cfg?.grace_lapse_weeks ?? 4;
      const deletionYrs = cfg?.deletion_years ?? 7;

      const now = new Date();
      const yr = now.getFullYear();
      const candidateStart = new Date(yr, ysm - 1, ysd);
      const yearStart = candidateStart <= now ? candidateStart : new Date(yr - 1, ysm - 1, ysd);
      const yearStartIso = yearStart.toISOString().slice(0, 10);

      let rows;
      if (mode === 'this_year') {
        rows = await tenantQuery(
          slug,
          `SELECT m.id, m.membership_number, m.forenames, m.surname, m.known_as,
                ms.name AS status_name,
                mc.name AS class_name,
                m.next_renewal, m.email, m.mobile,
                a.house_no, a.street, a.town, a.postcode, a.telephone,
                m.portal_password_hash IS NOT NULL AS has_portal_password,
                m.portal_email_verified,
                (SELECT EXTRACT(YEAR FROM MAX(t.date))::int
                 FROM transactions t
                 WHERE t.member_id_1 = m.id AND t.type = 'in') AS last_renewal_year
         FROM members m
         LEFT JOIN member_statuses ms ON ms.id = m.status_id
         LEFT JOIN member_classes  mc ON mc.id = m.class_id
         LEFT JOIN addresses        a ON a.id  = m.address_id
         WHERE ms.name ILIKE '%Current%'
           AND (m.next_renewal IS NULL OR m.next_renewal < $1::date)
         ORDER BY m.surname, m.forenames`,
          [yearStartIso],
        );
      } else {
        // Compute cutoff date in JS to avoid PostgreSQL interval casting issues
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - deletionYrs);
        const cutoffIso = cutoff.toISOString().slice(0, 10);

        rows = await tenantQuery(
          slug,
          `SELECT m.id, m.membership_number, m.forenames, m.surname, m.known_as,
                ms.name AS status_name,
                mc.name AS class_name,
                m.next_renewal, m.email, m.mobile,
                a.house_no, a.street, a.town, a.postcode, a.telephone,
                m.portal_password_hash IS NOT NULL AS has_portal_password,
                m.portal_email_verified,
                (SELECT EXTRACT(YEAR FROM MAX(t.date))::int
                 FROM transactions t
                 WHERE t.member_id_1 = m.id AND t.type = 'in') AS last_renewal_year
         FROM members m
         LEFT JOIN member_statuses ms ON ms.id = m.status_id
         LEFT JOIN member_classes  mc ON mc.id = m.class_id
         LEFT JOIN addresses        a ON a.id  = m.address_id
         WHERE m.next_renewal IS NOT NULL
           AND m.next_renewal < $1::date
         ORDER BY m.next_renewal, m.surname`,
          [cutoffIso],
        );
      }

      res.json({
        members: rows,
        mode,
        yearStart: yearStartIso,
        graceLapse,
        deletionYears: deletionYrs,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /members/lapse ──────────────────────────────────────────────────
// Changes status to the "Lapsed" status for the given member IDs.

router.post(
  '/lapse',
  requireFeature('membershipRenewals'),
  requirePrivilege('members_non_renewals', 'lapse'),
  async (req, res, next) => {
    try {
      const slug = req.user.tenantSlug;
      const { memberIds } = z.object({ memberIds: z.array(z.string()).min(1) }).parse(req.body);

      const [lapsedStatus] = await tenantQuery(
        slug,
        `SELECT id FROM member_statuses WHERE name ILIKE '%Lapsed%' ORDER BY name LIMIT 1`,
      );
      if (!lapsedStatus) throw new AppError('No "Lapsed" member status found.', 400);

      await tenantQuery(
        slug,
        `UPDATE members SET status_id = $1, updated_at = now()
       WHERE id = ANY($2::text[])`,
        [lapsedStatus.id, memberIds],
      );

      logAudit(slug, {
        userId: req.user.userId,
        userName: req.user.name,
        action: 'lapse',
        entityType: 'member',
        entityId: memberIds.join(','),
      });
      res.json({ lapsed: memberIds.length });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
