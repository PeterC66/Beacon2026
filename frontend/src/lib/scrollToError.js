// beacon2/frontend/src/lib/scrollToError.js
// Scroll to the first validation error after a failed save.

/**
 * scrollToFirstFieldError(errorKeys)
 * For forms with field-level errors (fieldErrors object).
 * Finds the first input/select whose `name` matches a key in the errors object
 * and scrolls it into view.
 *
 * @param {string[]} errorKeys — Object.keys(fieldErrors) in order
 */
export function scrollToFirstFieldError(errorKeys) {
  if (!errorKeys.length) return;
  for (const key of errorKeys) {
    const el = document.querySelector(`[name="${key}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
      return;
    }
  }
}

/**
 * scrollToFormError()
 * For forms with a single error message element at the top.
 * Call after setError() — uses requestAnimationFrame so the error element
 * is rendered before we try to find it.
 *
 * @param {string} [selector='[data-form-error]'] — CSS selector for the error element
 */
export function scrollToFormError(selector = '[data-form-error]') {
  requestAnimationFrame(() => {
    const el = document.querySelector(selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}
