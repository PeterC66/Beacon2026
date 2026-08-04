// beacon2026/frontend/src/hooks/useLetterJump.js
//
// Shared behaviour for the A-Z buttons above Members/Groups/Teams lists,
// used when the 'azButtonsJumpToRecord' feature toggle is on: clicking a
// letter scrolls to the first record starting with that letter instead of
// filtering the list down to it (the alternative, filter-based behaviour
// stays in each page's own `letter` state / API param).
//
// Usage:
//   const { rowRef, jumpToLetter, highlightId } = useLetterJump();
//   <tr ref={rowRef(item.id)} className={highlightId === item.id ? '...' : ''}>
//   <button onClick={() => jumpToLetter(sorted, 'surname', l)}>{l}</button>

import { useRef, useState } from 'react';

const HIGHLIGHT_MS = 1500;

export function useLetterJump() {
  const rowRefs = useRef({});
  const [highlightId, setHighlightId] = useState(null);
  const highlightTimer = useRef(null);

  function rowRef(id) {
    return (el) => {
      if (el) rowRefs.current[id] = el;
    };
  }

  function jumpToLetter(list, field, letter) {
    const target = (list ?? []).find(
      (item) => (item[field]?.[0] ?? '').toUpperCase() === letter.toUpperCase(),
    );
    if (!target) return;
    const el = rowRefs.current[target.id];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    clearTimeout(highlightTimer.current);
    setHighlightId(target.id);
    highlightTimer.current = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
  }

  return { rowRef, jumpToLetter, highlightId };
}
