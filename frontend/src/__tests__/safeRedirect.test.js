import { describe, it, expect } from 'vitest';
import { isSafePaymentRedirect } from '../lib/safeRedirect.js';

describe('isSafePaymentRedirect', () => {
  it('allows same-origin absolute URLs', () => {
    expect(isSafePaymentRedirect(`${window.location.origin}/portal/paid?ok=1`)).toBe(true);
  });

  it('allows same-origin relative paths', () => {
    expect(isSafePaymentRedirect('/portal/paid?ok=1')).toBe(true);
  });

  it('allows paypal.com and its sandbox', () => {
    expect(isSafePaymentRedirect('https://www.paypal.com/checkoutnow?token=X')).toBe(true);
    expect(isSafePaymentRedirect('https://sandbox.paypal.com/checkoutnow?token=X')).toBe(true);
    expect(isSafePaymentRedirect('https://www.sandbox.paypal.com/checkoutnow?token=X')).toBe(true);
  });

  it('blocks look-alike domains', () => {
    expect(isSafePaymentRedirect('https://paypal.com.evil.com/x')).toBe(false);
    expect(isSafePaymentRedirect('https://evilpaypal.com/x')).toBe(false);
    expect(isSafePaymentRedirect('https://paypal.co/x')).toBe(false);
  });

  it('blocks arbitrary third-party origins', () => {
    expect(isSafePaymentRedirect('https://evil.example.com/go')).toBe(false);
  });

  it('blocks non-http(s) schemes', () => {
    expect(isSafePaymentRedirect('javascript:alert(1)')).toBe(false);
    expect(isSafePaymentRedirect('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects empty or non-string input', () => {
    expect(isSafePaymentRedirect('')).toBe(false);
    expect(isSafePaymentRedirect(null)).toBe(false);
    expect(isSafePaymentRedirect(undefined)).toBe(false);
    expect(isSafePaymentRedirect(42)).toBe(false);
  });
});
