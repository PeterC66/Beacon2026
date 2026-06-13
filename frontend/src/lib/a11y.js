// Accessibility helpers.

/**
 * Props that make a non-button element (e.g. a <span> or <th>) behave like a
 * button for keyboard users: it becomes focusable and activates on Enter/Space.
 *
 *   <span {...clickableKeyProps(() => onSort('name'))}>Name</span>
 *
 * Spreads `role="button"`, `tabIndex={0}`, `onClick`, and an `onKeyDown` that
 * fires the same handler on Enter or Space (preventing the Space-scroll).
 */
export function clickableKeyProps(onActivate) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate(e);
      }
    },
  };
}
