// beacon2/frontend/src/hooks/useSortedData.js
// Client-side sort state for table columns.
// Usage:
//   const { sorted, sortKey, sortDir, onSort } = useSortedData(data);
//   <SortableHeader col="name" ... sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
//   {sorted.map(...)}

import { useState, useMemo } from 'react';

// Compare two values (handles null, boolean, number, string).
function compareValues(av, bv) {
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  if (typeof av === 'boolean') return av === bv ? 0 : av ? -1 : 1;
  if (typeof av === 'number') return av - bv;
  return String(av).toLowerCase().localeCompare(String(bv).toLowerCase());
}

/**
 * sortKey may be a single field name (string) or an array of field names
 * for compound sorting, e.g. ['surname', 'forenames'].
 */
export function useSortedData(data, defaultKey = null, defaultDir = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  function keysEqual(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b))
      return a.length === b.length && a.every((v, i) => v === b[i]);
    return false;
  }

  function onSort(key) {
    if (keysEqual(key, sortKey)) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey || !data) return data ?? [];
    const keys = Array.isArray(sortKey) ? sortKey : [sortKey];
    return [...data].sort((a, b) => {
      for (const k of keys) {
        const cmp = compareValues(a[k], b[k]);
        if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, onSort };
}
