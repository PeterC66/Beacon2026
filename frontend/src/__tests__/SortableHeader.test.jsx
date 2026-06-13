// beacon2/frontend/src/__tests__/SortableHeader.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import SortableHeader from '../components/SortableHeader.jsx';

// SortableHeader renders a <th>, so wrap it in a valid table structure.
function renderHeader(props) {
  return render(
    <table>
      <thead>
        <tr>
          <SortableHeader {...props} />
        </tr>
      </thead>
    </table>,
  );
}

describe('SortableHeader', () => {
  it('renders the label', () => {
    const { getByText } = renderHeader({ col: 'name', label: 'Name', onSort: vi.fn() });
    expect(getByText('Name')).toBeInTheDocument();
  });

  it('calls onSort with the column on click', () => {
    const onSort = vi.fn();
    const { getByRole } = renderHeader({ col: 'name', label: 'Name', onSort });
    fireEvent.click(getByRole('button'));
    expect(onSort).toHaveBeenCalledWith('name');
  });

  it('is keyboard-focusable and activates on Enter', () => {
    const onSort = vi.fn();
    const { getByRole } = renderHeader({ col: 'name', label: 'Name', onSort });
    const th = getByRole('button');
    expect(th).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(th, { key: 'Enter' });
    expect(onSort).toHaveBeenCalledWith('name');
  });

  it('activates on Space', () => {
    const onSort = vi.fn();
    const { getByRole } = renderHeader({ col: 'name', label: 'Name', onSort });
    fireEvent.keyDown(getByRole('button'), { key: ' ' });
    expect(onSort).toHaveBeenCalledWith('name');
  });

  it('reflects ascending sort state via aria-sort', () => {
    const { getByRole } = renderHeader({
      col: 'name',
      label: 'Name',
      sortKey: 'name',
      sortDir: 'asc',
      onSort: vi.fn(),
    });
    expect(getByRole('button')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('reflects descending sort state via aria-sort', () => {
    const { getByRole } = renderHeader({
      col: 'name',
      label: 'Name',
      sortKey: 'name',
      sortDir: 'desc',
      onSort: vi.fn(),
    });
    expect(getByRole('button')).toHaveAttribute('aria-sort', 'descending');
  });

  it('reports aria-sort none when not the active column', () => {
    const { getByRole } = renderHeader({
      col: 'name',
      label: 'Name',
      sortKey: 'other',
      sortDir: 'asc',
      onSort: vi.fn(),
    });
    expect(getByRole('button')).toHaveAttribute('aria-sort', 'none');
  });

  it('matches an array column against an array sortKey', () => {
    const { getByRole } = renderHeader({
      col: ['surname', 'forenames'],
      label: 'by surname',
      sortKey: ['surname', 'forenames'],
      sortDir: 'asc',
      onSort: vi.fn(),
    });
    expect(getByRole('button')).toHaveAttribute('aria-sort', 'ascending');
  });
});
