// beacon2026/backend/src/__tests__/logger.test.js
// Unit tests for the minimal structured logger: console routing, level
// gating via LOG_LEVEL, line format, and safe handling of bad context.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger } from '../utils/logger.js';

describe('logger', () => {
  let errorSpy;
  let warnSpy;
  let logSpy;
  const savedLevel = process.env.LOG_LEVEL;
  const savedEnv = process.env.NODE_ENV;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Ensure all levels are eligible unless a test overrides LOG_LEVEL.
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (savedLevel === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = savedLevel;
    process.env.NODE_ENV = savedEnv;
  });

  it('routes each level to the matching console method', () => {
    logger.error('boom');
    logger.warn('careful');
    logger.info('fyi');
    logger.debug('details');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    // info and debug both go to console.log
    expect(logSpy).toHaveBeenCalledTimes(2);
  });

  it('formats a line with timestamp, level, message and JSON context', () => {
    logger.info('hello', { a: 1, b: 'two' });
    const line = logSpy.mock.calls[0][0];
    expect(line).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z \[info\] hello /);
    expect(line).toContain('{"a":1,"b":"two"}');
  });

  it('omits the context segment when none is given', () => {
    logger.warn('lonely');
    const line = warnSpy.mock.calls[0][0];
    expect(line).toMatch(/\[warn\] lonely$/);
  });

  it('gates lower-priority levels when LOG_LEVEL is raised', () => {
    process.env.LOG_LEVEL = 'warn';
    logger.error('e');
    logger.warn('w');
    logger.info('i');
    logger.debug('d');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    // info and debug are below the warn threshold — suppressed
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('never logs below info even with an unknown/invalid LOG_LEVEL in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_LEVEL = 'nonsense';
    logger.info('shown');
    logger.debug('hidden');

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain('shown');
  });

  it('does not throw on non-serialisable context', () => {
    const circular = {};
    circular.self = circular;
    expect(() => logger.info('round', circular)).not.toThrow();
    expect(logSpy.mock.calls[0][0]).toContain('[unserialisable context]');
  });
});
