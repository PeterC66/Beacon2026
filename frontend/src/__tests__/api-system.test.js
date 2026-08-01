// beacon2026/frontend/src/__tests__/api-system.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { system } from '../lib/api/system.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('system.createTenant error handling', () => {
  it('surfaces the Zod issue message when validation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () =>
          Promise.resolve({
            error: 'Validation error',
            issues: [
              {
                path: 'adminPassword',
                message:
                  'Password must contain at least one uppercase, one lowercase, and one numeric character.',
              },
            ],
          }),
      }),
    );

    await expect(system.createTenant('token', {})).rejects.toThrow(
      'adminPassword: Password must contain at least one uppercase, one lowercase, and one numeric character.',
    );
  });

  it('falls back to the plain error message when there are no issues', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: 'A u3a with that slug already exists.' }),
      }),
    );

    await expect(system.createTenant('token', {})).rejects.toThrow(
      'A u3a with that slug already exists.',
    );
  });
});
