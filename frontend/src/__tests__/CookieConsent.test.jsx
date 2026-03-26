// beacon2/frontend/src/__tests__/CookieConsent.test.jsx

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import CookieConsent from '../components/CookieConsent.jsx';
import { getConsentValue, hasOptionalCookieConsent, setConsent } from '../hooks/useCookieConsent.js';

// Helper to clear all test cookies
function clearCookies() {
  document.cookie.split(';').forEach((c) => {
    const name = c.trim().split('=')[0];
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
}

describe('useCookieConsent', () => {
  beforeEach(clearCookies);
  afterEach(clearCookies);

  it('returns null when no consent cookie exists', () => {
    expect(getConsentValue()).toBeNull();
  });

  it('returns false for hasOptionalCookieConsent when no cookie', () => {
    expect(hasOptionalCookieConsent()).toBe(false);
  });

  it('records accepted consent', () => {
    setConsent(true);
    expect(getConsentValue()).toBe('accepted');
    expect(hasOptionalCookieConsent()).toBe(true);
  });

  it('records declined consent', () => {
    setConsent(false);
    expect(getConsentValue()).toBe('declined');
    expect(hasOptionalCookieConsent()).toBe(false);
  });

  it('clears optional cookies and localStorage on decline', () => {
    // Set up optional data
    document.cookie = 'beacon_last_u3a=test-slug; path=/';
    localStorage.setItem('beacon2_prefs', JSON.stringify({ sortBy: 'forename' }));
    localStorage.setItem('beacon2_label_settings', JSON.stringify({ cols: 2 }));
    localStorage.setItem('beacon2_last_export_class', '5');
    localStorage.setItem('beacon2_email_compose_prefs', JSON.stringify({ fromEmail: 'a@b.com' }));

    setConsent(false);

    // beacon_last_u3a should be deleted
    expect(document.cookie).not.toContain('beacon_last_u3a');
    // All optional localStorage should be removed
    expect(localStorage.getItem('beacon2_prefs')).toBeNull();
    expect(localStorage.getItem('beacon2_label_settings')).toBeNull();
    expect(localStorage.getItem('beacon2_last_export_class')).toBeNull();
    expect(localStorage.getItem('beacon2_email_compose_prefs')).toBeNull();
  });
});

describe('CookieConsent component', () => {
  beforeEach(clearCookies);
  afterEach(clearCookies);

  it('shows dialog when no consent cookie exists', () => {
    const { getByText } = render(<CookieConsent />);
    expect(getByText('This site uses cookies to store information on your computer.')).toBeInTheDocument();
  });

  it('does not show dialog when consent already given', () => {
    setConsent(true);
    const { queryByText } = render(<CookieConsent />);
    expect(queryByText('This site uses cookies to store information on your computer.')).not.toBeInTheDocument();
  });

  it('shows gear icon when dialog is closed', () => {
    setConsent(true);
    const { getByTitle } = render(<CookieConsent />);
    expect(getByTitle('Cookie settings')).toBeInTheDocument();
  });

  it('hides dialog and records consent on accept', () => {
    const { getByText, queryByText } = render(<CookieConsent />);
    fireEvent.click(getByText('I Accept optional cookies'));
    expect(queryByText('This site uses cookies to store information on your computer.')).not.toBeInTheDocument();
    expect(getConsentValue()).toBe('accepted');
  });

  it('hides dialog and records decline on "I Do Not Accept"', () => {
    const { getByText, queryByText } = render(<CookieConsent />);
    fireEvent.click(getByText('I Do Not Accept'));
    expect(queryByText('This site uses cookies to store information on your computer.')).not.toBeInTheDocument();
    expect(getConsentValue()).toBe('declined');
  });

  it('reopens dialog when gear icon is clicked', () => {
    setConsent(true);
    const { getByTitle, getByText } = render(<CookieConsent />);
    fireEvent.click(getByTitle('Cookie settings'));
    expect(getByText('This site uses cookies to store information on your computer.')).toBeInTheDocument();
  });

  it('shows optional cookies details when expanded', () => {
    const { getByText } = render(<CookieConsent />);
    fireEvent.click(getByText(/Optional Cookies/));
    expect(getByText('The name of the u3a site you login to')).toBeInTheDocument();
    expect(getByText(/timeout period/)).toBeInTheDocument();
    expect(getByText(/Last membership class used for exporting/)).toBeInTheDocument();
    expect(getByText(/Label printing settings/)).toBeInTheDocument();
    expect(getByText(/TAM.*submission status/)).toBeInTheDocument();
    expect(getByText(/Email compose.*From.*address/)).toBeInTheDocument();
  });
});
