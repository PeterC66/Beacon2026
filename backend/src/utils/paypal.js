// beacon2/backend/src/utils/paypal.js
// PayPal integration stub.
// This module defines the interface for PayPal payments.
// Currently uses stub implementations for development/testing.
// Replace the stub functions with real PayPal API calls when ready.

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
  // STUB: Generate a fake payment ID and return a simulated redirect URL.
  // In production, this would call PayPal's Create Order API.
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
  // STUB: Always verify as successful.
  // In production, this would validate the IPN with PayPal.
  return {
    verified: true,
    grossAmount: rawBody?.gross ?? 0,
    fee: rawBody?.fee ?? 0,
    payerEmail: rawBody?.payerEmail ?? '',
    status: 'completed',
  };
}
