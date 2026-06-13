// beacon2/frontend/src/__tests__/a11y.test.js
import { describe, it, expect, vi } from 'vitest';
import { clickableKeyProps } from '../lib/a11y.js';

describe('clickableKeyProps', () => {
  it('exposes button role and is focusable', () => {
    const props = clickableKeyProps(() => {});
    expect(props.role).toBe('button');
    expect(props.tabIndex).toBe(0);
  });

  it('fires the handler on click', () => {
    const fn = vi.fn();
    clickableKeyProps(fn).onClick();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fires the handler on Enter and prevents default', () => {
    const fn = vi.fn();
    const e = { key: 'Enter', preventDefault: vi.fn() };
    clickableKeyProps(fn).onKeyDown(e);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('fires the handler on Space and prevents the page scroll', () => {
    const fn = vi.fn();
    const e = { key: ' ', preventDefault: vi.fn() };
    clickableKeyProps(fn).onKeyDown(e);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('ignores other keys', () => {
    const fn = vi.fn();
    const e = { key: 'a', preventDefault: vi.fn() };
    clickableKeyProps(fn).onKeyDown(e);
    expect(fn).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});
