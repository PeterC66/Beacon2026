// Guards against open redirects in flows where the backend returns a URL for
// the browser to navigate to (currently the PayPal payment flow). The backend
// is trusted under normal operation, but if it were compromised or
// mis-configured a user could be sent to a phishing site.
//
// Allowed destinations:
//   • Same origin as the frontend (the stub PayPal flow redirects back to our
//     own confirmation pages).
//   • PayPal live and sandbox domains.
//
// Anything else is blocked.

const ALLOWED_HOSTS = new Set([
  'paypal.com',
  'www.paypal.com',
  'sandbox.paypal.com',
  'www.sandbox.paypal.com',
]);

export function isSafePaymentRedirect(url) {
  if (typeof url !== 'string' || !url) return false;
  let u;
  try {
    u = new URL(url, window.location.origin);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (u.origin === window.location.origin) return true;
  return ALLOWED_HOSTS.has(u.hostname);
}
