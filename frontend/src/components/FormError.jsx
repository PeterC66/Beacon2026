/**
 * Inline validation error message for a form field.
 * Renders nothing when there is no error, so it can be dropped in directly:
 *   <Input ... />
 *   <FormError error={fieldErrors.surname} />
 *
 * `size="sm"` (default) matches the dominant field style; `size="xs"` is the
 * compact variant used in tighter inline forms. Pass `className` to append
 * extra utility classes.
 */
export default function FormError({ error, size = 'sm', className = '' }) {
  if (!error) return null;
  const base =
    size === 'xs' ? 'text-xs text-red-600 mt-0.5' : 'text-sm text-red-600 mt-1 font-medium';
  return <p className={`${base} ${className}`.trim()}>{error}</p>;
}
