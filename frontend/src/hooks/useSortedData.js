// beacon2/frontend/src/hooks/useSortedData.js
// Client-side sort state for table columns.
// Usage:
//   const { sorted, sortKey, sortDir, onSort } = useSortedData(data);
//   <SortableHeader col="name" ... sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
//   {sorted.map(...)}

import { useState, useMemo } from 'react';

export function useSortedData(data, defaultKey = null, defaultDir = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  function onSort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey || !data) return data ?? [];
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Nulls always last regardless of direction
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp;
      if (typeof av === 'boolean') {
        cmp = av === bv ? 0 : av ? -1 : 1;   // true first in asc
      } else if (typeof av === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).toLowerCase().localeCompare(String(bv).toLowerCase());
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, onSort };
}
