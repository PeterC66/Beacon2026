// beacon2026/frontend/src/__tests__/Button.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Button from '../components/ui/Button.jsx';

describe('Button', () => {
  it('renders its children', () => {
    const { getByRole } = render(<Button>Save</Button>);
    expect(getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    const { getByRole } = render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies the primary variant classes by default', () => {
    const { getByRole } = render(<Button>Go</Button>);
    expect(getByRole('button').className).toContain('bg-blue-600');
  });

  it('applies the danger variant classes', () => {
    const { getByRole } = render(<Button variant="danger">Delete</Button>);
    expect(getByRole('button').className).toContain('bg-red-600');
  });

  it('falls back to primary for an unknown variant', () => {
    const { getByRole } = render(<Button variant="nope">Go</Button>);
    expect(getByRole('button').className).toContain('bg-blue-600');
  });

  it('applies the requested size classes', () => {
    const { getByRole } = render(<Button size="sm">Go</Button>);
    expect(getByRole('button').className).toContain('text-xs');
  });

  it('appends a custom className and forwards arbitrary props', () => {
    const { getByRole } = render(
      <Button className="extra-class" type="submit" disabled>
        Go
      </Button>,
    );
    const btn = getByRole('button');
    expect(btn.className).toContain('extra-class');
    expect(btn).toHaveAttribute('type', 'submit');
    expect(btn).toBeDisabled();
  });
});
