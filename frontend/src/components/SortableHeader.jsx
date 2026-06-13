// beacon2/frontend/src/components/SortableHeader.jsx
// Renders a <th> that shows a sort indicator and calls onSort when clicked.
// Keyboard accessible: focusable and activates on Enter/Space, with aria-sort
// reflecting the current sort state for screen readers.
// Usage:
//   <SortableHeader col="name" label="Name" sortKey={sortKey} sortDir={sortDir}
//                   onSort={onSort} className="px-4 py-2.5 font-normal" />

import { clickableKeyProps } from '../lib/a11y.js';

export default function SortableHeader({ col, label, sortKey, sortDir, onSort, className = '' }) {
  const active =
    Array.isArray(col) && Array.isArray(sortKey)
      ? col.length === sortKey.length && col.every((v, i) => v === sortKey[i])
      : col === sortKey;
  return (
    <th
      className={`cursor-pointer select-none ${className}`}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      {...clickableKeyProps(() => onSort(col))}
    >
      {label}
      <span className={`ml-1 text-xs ${active ? 'text-blue-600' : 'text-slate-300'}`}>
        {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  );
}
