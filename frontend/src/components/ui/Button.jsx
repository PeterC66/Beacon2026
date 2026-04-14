// beacon2/frontend/src/components/ui/Button.jsx
// Shared button primitive — use instead of repeating Tailwind button classes.
// Adopt incrementally; no need to convert existing buttons all at once.

const VARIANTS = {
  primary:   'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white',
  danger:    'bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white',
  secondary: 'bg-white hover:bg-slate-50 border border-slate-300 text-slate-700',
  success:       'bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white',
  dangerOutline: 'bg-white hover:bg-red-50 border border-red-300 text-red-600',
};

const SIZES = {
  sm:      'px-3 py-1 text-xs',
  default: 'px-4 py-2 text-sm',
  lg:      'px-5 py-2 text-sm',
};

export default function Button({
  variant = 'primary',
  size = 'default',
  className = '',
  ...props
}) {
  return (
    <button
      className={`${VARIANTS[variant] ?? VARIANTS.primary} ${SIZES[size] ?? SIZES.default} rounded font-medium transition-colors ${className}`}
      {...props}
    />
  );
}
