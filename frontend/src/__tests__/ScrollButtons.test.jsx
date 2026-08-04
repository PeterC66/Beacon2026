// beacon2026/frontend/src/__tests__/ScrollButtons.test.jsx
// Regression test for the "buttons only appear after you move the mouse"
// bug: many list pages render their table container only after an async
// fetch resolves (`{!loading && <Table ref={containerRef} />}`), which
// happens *after* ScrollButtons' mount effect has already run once and
// found containerRef.current still null. Without a per-render recheck, the
// buttons stayed hidden until the next window 'scroll'/'resize' event.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import ScrollButtons from '../components/ScrollButtons.jsx';

function Harness({ mountContainer }) {
  const containerRef = useRef(null);
  return (
    <div>
      {mountContainer && <div ref={containerRef} data-testid="container" />}
      <ScrollButtons containerRef={containerRef} />
    </div>
  );
}

const originalRect = Element.prototype.getBoundingClientRect;
const originalInnerHeight = window.innerHeight;

beforeEach(() => {
  window.innerHeight = 800;
  // Simulate a container much taller than the viewport, scrolled so both
  // the top and bottom edges are off-screen — both buttons should show.
  Element.prototype.getBoundingClientRect = () => ({
    top: -100,
    bottom: 1000,
    height: 1100,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: -100,
    toJSON() {},
  });
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalRect;
  window.innerHeight = originalInnerHeight;
});

describe('ScrollButtons', () => {
  it('shows nothing while the watched container has not mounted yet', () => {
    render(<Harness mountContainer={false} />);
    expect(screen.queryByTitle('Scroll to top')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Scroll to bottom')).not.toBeInTheDocument();
  });

  it('shows the buttons as soon as the container mounts, with no scroll/resize event', async () => {
    const { rerender } = render(<Harness mountContainer={false} />);
    rerender(<Harness mountContainer />);

    await waitFor(() => expect(screen.getByTitle('Scroll to top')).toBeInTheDocument());
    expect(screen.getByTitle('Scroll to bottom')).toBeInTheDocument();
  });
});
