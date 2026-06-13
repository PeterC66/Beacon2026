// beacon2/frontend/src/hooks/useAsyncLoad.js
// Standard data-fetching hook: replaces the repeated
//   const [data, setData] = useState(...)
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState(null)
//   useEffect(() => { load() }, [deps])
//   async function load() { setLoading(true); setError(null); try { setData(await fn()) } ... }
// boilerplate found across ~30 pages.
//
// Usage:
//   const { data, loading, error, reload, setData, setError } = useAsyncLoad(
//     () => membersApi.list({ filter }),
//     [filter],
//   );
//
// `reload()` re-runs the loader (also returns the resolved value) and is stable
// for the given deps, so it is safe to call from event handlers. Pass
// `{ immediate: false }` to skip the initial automatic load (e.g. token-gated
// pages that load on demand), and `{ initialData }` to seed `data`.

import { useState, useEffect, useCallback } from 'react';

export function useAsyncLoad(loader, deps = [], { initialData = null, immediate = true } = {}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  // `loader` is typically a fresh arrow each render; we intentionally key the
  // memoised reload on the caller-supplied deps instead.
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loader();
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      return undefined;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (immediate) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  return { data, setData, loading, setLoading, error, setError, reload };
}
