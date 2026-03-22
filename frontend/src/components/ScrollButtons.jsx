// beacon2/frontend/src/components/ScrollButtons.jsx
// Dual floating buttons to scroll to the top/bottom of a table container.
// Only visible when the container overflows the viewport.

import { useState, useEffect, useCallback } from 'react';

const CHEVRON_UP = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

const CHEVRON_DOWN = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 11.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const btnCls =
  'flex items-center justify-center w-10 h-10 rounded-full ' +
  'bg-slate-600 hover:bg-slate-700 text-white shadow-lg ' +
  'transition-opacity duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400';

/**
 * Renders scroll-to-top and scroll-to-bottom buttons that float beside
 * a table container. Only shown when the container is taller than the viewport.
 *
 * @param {{ containerRef: React.RefObject<HTMLElement> }} props
 */
export default function ScrollButtons({ containerRef }) {
  const [showTop, setShowTop]       = useState(false);
  const [showBottom, setShowBottom]  = useState(false);

  const update = useCallback(() => {
    const el = containerRef?.current;
    if (!el) { setShowTop(false); setShowBottom(false); return; }

    const rect = el.getBoundingClientRect();
    const viewH = window.innerHeight;

    // Container must be taller than viewport to warrant buttons
    if (rect.height <= viewH) {
      setShowTop(false);
      setShowBottom(false);
      return;
    }

    // Show "scroll to top" when the top of the container is above the viewport
    setShowTop(rect.top < 0);
    // Show "scroll to bottom" when the bottom of the container is below the viewport
    setShowBottom(rect.bottom > viewH);
  }, [containerRef]);

  useEffect(() => {
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });

    // Re-check when the container itself resizes (e.g. data loads async)
    const el = containerRef?.current;
    let ro;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      if (ro) ro.disconnect();
    };
  }, [update, containerRef]);

  const scrollToTop = () => {
    const el = containerRef?.current;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToBottom = () => {
    const el = containerRef?.current;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  if (!showTop && !showBottom) return null;

  return (
    <>
      {showTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className={`${btnCls} fixed top-20 right-6 z-40`}
          title="Scroll to top"
          aria-label="Scroll to top of list"
        >
          {CHEVRON_UP}
        </button>
      )}
      {showBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className={`${btnCls} fixed bottom-6 right-6 z-40`}
          title="Scroll to bottom"
          aria-label="Scroll to bottom of list"
        >
          {CHEVRON_DOWN}
        </button>
      )}
    </>
  );
}
