// beacon2/backend/src/utils/paypal.js
// PayPal integration stub.
// This module defines the interface for PayPal payments.
// Currently uses stub implementations for development/testing.
// Replace the stub functions with real PayPal API calls when ready.
//
// The exported functions destructure their full documented parameter set even
// though the stub bodies ignore most of them — keeping the real API shape
// visible for whoever wires PayPal up. Disable the unused-args rule for the file.
/* eslint-disable no-unused-vars */

import { randomBytes } from 'crypto';

/**
 * Initiate a PayPal payment.
 * In production, this would create a PayPal order via the REST API
 * and return a redirect URL to the PayPal checkout page.
 *
 * @param {object} params
 * @param {number} params.amount - Payment amount in GBP
 * @param {string} params.description - Item description (e.g. "Membership: Individual")
 * @param {string} params.memberRef - Reference to the member record (member ID)
 * @param {string} params.returnUrl - URL to redirect after successful payment
 * @param {string} params.cancelUrl - URL to redirect if payment is cancelled
 * @param {string} params.paypalEmail - The u3a's PayPal account email
 * @returns {Promise<{ paymentId: string, redirectUrl: string }>}
 */
export async function initiatePayment({ amount, description, memberRef, returnUrl, cancelUrl, paypalEmail }) {
  // STUB: handing out fake payment IDs in production would orphan Applicants
  // and mislead operators into thinking PayPal is wired up. Refuse unless
  // we're outside production or the operator has explicitly opted in. The
  // companion verifyPaymentNotification() in this file is gated the same way.
  const stubAllowed =
    process.env.NODE_ENV !== 'production' ||
    process.env.PAYPAL_STUB_ALLOW === 'true';
  if (!stubAllowed) {
    throw new Error(
      'PayPal integration is not configured. Set PAYPAL_STUB_ALLOW=true to ' +
      'enable the development stub, or wire the real PayPal REST API.',
    );
  }

  const paymentId = `PAY-STUB-${randomBytes(12).toString('hex')}`;
  // In the stub, we redirect to our own confirmation endpoint to simulate success
  const redirectUrl = `${returnUrl}?paymentId=${paymentId}&status=success`;
  return { paymentId, redirectUrl };
}

/**
 * Verify a PayPal payment notification (IPN or webhook).
 * In production, this would verify the IPN signature with PayPal
 * and extract the payment details.
 *
 * @param {object} params
 * @param {string} params.paymentId - The payment ID from the notification
 * @param {object} params.rawBody - The raw request body from PayPal
 * @returns {Promise<{ verified: boolean, grossAmount: number, fee: number, payerEmail: string, status: string }>}
 */
export async function verifyPaymentNotification({ paymentId, rawBody }) {
  // STUB: always-verify is unsafe to leave reachable in production — the
  // public /payment-confirm endpoint would otherwise let anyone flip an
  // Applicant to Current without paying. Until real IPN verification is
  // wired up, refuse in production unless the operator has explicitly
  // opted in with PAYPAL_STUB_ALLOW=true.
  const stubAllowed =
    process.env.NODE_ENV !== 'production' ||
    process.env.PAYPAL_STUB_ALLOW === 'true';
  if (!stubAllowed) {
    return { verified: false, grossAmount: 0, fee: 0, payerEmail: '', status: 'rejected_stub_in_production' };
  }
  return {
    verified: true,
    grossAmount: rawBody?.gross ?? 0,
    fee: rawBody?.fee ?? 0,
    payerEmail: rawBody?.payerEmail ?? '',
    status: 'completed',
  };
}
