// beacon2/frontend/src/__tests__/FormError.test.jsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import FormError from '../components/FormError.jsx';

describe('FormError', () => {
  it('renders nothing when there is no error', () => {
    const { container } = render(<FormError error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an empty-string error', () => {
    const { container } = render(<FormError error="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the error message when present', () => {
    const { getByText } = render(<FormError error="Surname is required" />);
    expect(getByText('Surname is required')).toBeInTheDocument();
  });

  it('uses the default (sm) size classes', () => {
    const { getByText } = render(<FormError error="Bad" />);
    expect(getByText('Bad').className).toContain('text-sm');
  });

  it('uses the xs size classes when requested', () => {
    const { getByText } = render(<FormError error="Bad" size="xs" />);
    expect(getByText('Bad').className).toContain('text-xs');
  });

  it('appends a custom className', () => {
    const { getByText } = render(<FormError error="Bad" className="mt-4" />);
    expect(getByText('Bad').className).toContain('mt-4');
  });
});
