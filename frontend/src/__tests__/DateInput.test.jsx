// beacon2026/frontend/src/__tests__/DateInput.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import DateInput from '../components/DateInput.jsx';

// The text field is the first <input>; query by its placeholder.
function getTextInput(getByPlaceholderText) {
  return getByPlaceholderText('dd/mm/yyyy');
}

describe('DateInput', () => {
  it('displays an ISO value in dd/mm/yyyy format', () => {
    const { getByPlaceholderText } = render(<DateInput value="2026-03-09" onChange={vi.fn()} />);
    expect(getTextInput(getByPlaceholderText).value).toBe('09/03/2026');
  });

  it('shows an empty field for an empty value', () => {
    const { getByPlaceholderText } = render(<DateInput value="" onChange={vi.fn()} />);
    expect(getTextInput(getByPlaceholderText).value).toBe('');
  });

  it('emits ISO format when a full date is typed', () => {
    const onChange = vi.fn();
    const { getByPlaceholderText } = render(<DateInput value="" onChange={onChange} />);
    fireEvent.change(getTextInput(getByPlaceholderText), { target: { value: '25/12/2026' } });
    expect(onChange).toHaveBeenCalledWith('2026-12-25');
  });

  it('emits an empty string when the field is cleared', () => {
    const onChange = vi.fn();
    const { getByPlaceholderText } = render(<DateInput value="2026-01-01" onChange={onChange} />);
    fireEvent.change(getTextInput(getByPlaceholderText), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('does not emit for an incomplete / invalid date', () => {
    const onChange = vi.fn();
    const { getByPlaceholderText } = render(<DateInput value="" onChange={onChange} />);
    fireEvent.change(getTextInput(getByPlaceholderText), { target: { value: '25/12' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('re-syncs the displayed text when the value prop changes', () => {
    const { getByPlaceholderText, rerender } = render(
      <DateInput value="2026-03-09" onChange={vi.fn()} />,
    );
    rerender(<DateInput value="2027-06-01" onChange={vi.fn()} />);
    expect(getTextInput(getByPlaceholderText).value).toBe('01/06/2027');
  });

  it('hides the calendar picker button when disabled', () => {
    const { queryByTitle } = render(<DateInput value="" onChange={vi.fn()} disabled />);
    expect(queryByTitle('Open date picker')).toBeNull();
  });

  it('shows the calendar picker button when enabled', () => {
    const { getByTitle } = render(<DateInput value="" onChange={vi.fn()} />);
    expect(getByTitle('Open date picker')).toBeInTheDocument();
  });
});
