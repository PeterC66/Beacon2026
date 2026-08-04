// beacon2026/frontend/src/__tests__/DefaultTemplatesSection.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import DefaultTemplatesSection from '../pages/system/DefaultTemplatesSection.jsx';

const listDefaultMessages = vi.fn();
const createDefaultMessage = vi.fn();
const rolloutDefaultMessage = vi.fn();
const deleteDefaultMessage = vi.fn();
const listDefaultLetters = vi.fn();

vi.mock('../lib/api.js', () => ({
  system: {
    listDefaultMessages: (...args) => listDefaultMessages(...args),
    createDefaultMessage: (...args) => createDefaultMessage(...args),
    updateDefaultMessage: vi.fn(),
    deleteDefaultMessage: (...args) => deleteDefaultMessage(...args),
    rolloutDefaultMessage: (...args) => rolloutDefaultMessage(...args),
    listDefaultLetters: (...args) => listDefaultLetters(...args),
    createDefaultLetter: vi.fn(),
    updateDefaultLetter: vi.fn(),
    deleteDefaultLetter: vi.fn(),
    rolloutDefaultLetter: vi.fn(),
  },
  getSysToken: () => 'fake-sys-token',
}));

beforeEach(() => {
  vi.clearAllMocks();
  listDefaultMessages.mockResolvedValue([
    { id: 'm1', name: 'New Member Welcome', subject: 'Welcome to #U3ANAME', body: 'Dear #FAM' },
  ]);
  listDefaultLetters.mockResolvedValue([
    { id: 'l1', name: 'Annual Data Check Form', body: '{"type":"doc","content":[]}' },
  ]);
});

describe('DefaultTemplatesSection', () => {
  it('lists default messages and letters', async () => {
    render(<DefaultTemplatesSection />);
    expect(await screen.findByText('New Member Welcome')).toBeInTheDocument();
    expect(await screen.findByText('Annual Data Check Form')).toBeInTheDocument();
  });

  it('creates a new default message', async () => {
    createDefaultMessage.mockResolvedValueOnce({
      id: 'm2',
      name: 'Second Email',
      subject: 'Hi',
      body: 'Hello',
    });
    render(<DefaultTemplatesSection />);
    await screen.findByText('New Member Welcome');

    fireEvent.change(screen.getAllByLabelText('Name')[0], { target: { value: 'Second Email' } });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hi' } });
    fireEvent.change(screen.getByLabelText('Message body'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

    await waitFor(() =>
      expect(createDefaultMessage).toHaveBeenCalledWith('fake-sys-token', {
        name: 'Second Email',
        subject: 'Hi',
        body: 'Hello',
      }),
    );
  });

  it('rolls out a default message and shows the per-tenant result', async () => {
    rolloutDefaultMessage.mockResolvedValueOnce({
      template: 'New Member Welcome',
      results: [
        { slug: 'stives', name: 'St Ives', created: true },
        { slug: 'demo', name: 'Demo u3a', created: false },
      ],
    });
    render(<DefaultTemplatesSection />);
    const row = (await screen.findByText('New Member Welcome')).closest('tr');
    fireEvent.click(within(row).getByRole('button', { name: 'Roll out' }));

    expect(await within(row).findByText('Created in: St Ives')).toBeInTheDocument();
    expect(within(row).getByText('Already had it: Demo u3a')).toBeInTheDocument();
    expect(rolloutDefaultMessage).toHaveBeenCalledWith('fake-sys-token', 'm1');
  });

  it('deletes a default letter after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    deleteDefaultMessage.mockResolvedValueOnce(undefined);
    render(<DefaultTemplatesSection />);
    const row = (await screen.findByText('New Member Welcome')).closest('tr');
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteDefaultMessage).toHaveBeenCalledWith('fake-sys-token', 'm1'));
  });
});
