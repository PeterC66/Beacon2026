// beacon2/backend/src/__tests__/uploads.test.js
// Unit tests for the upload-hardening helpers (ImprovementPlan Chunk 5):
// image magic-byte sniffing, attachment filename sanitisation, and the
// multer MIME fileFilter.

import { describe, it, expect, vi } from 'vitest';
import {
  sniffImageMime,
  decodeAndValidateImage,
  sanitizeAttachmentFilename,
  mimeFileFilter,
} from '../utils/uploads.js';

// 1x1 red PNG.
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
const PNG = Buffer.from(PNG_B64, 'base64');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF = Buffer.from('GIF89a', 'latin1');

describe('sniffImageMime', () => {
  it('recognises PNG, JPEG and GIF signatures', () => {
    expect(sniffImageMime(PNG)).toBe('image/png');
    expect(sniffImageMime(JPEG)).toBe('image/jpeg');
    expect(sniffImageMime(GIF)).toBe('image/gif');
  });

  it('returns null for non-image / short buffers', () => {
    expect(sniffImageMime(Buffer.from('not an image'))).toBeNull();
    expect(sniffImageMime(Buffer.from([0x00, 0x01]))).toBeNull();
    expect(sniffImageMime('not a buffer')).toBeNull();
  });
});

describe('decodeAndValidateImage', () => {
  it('returns the decoded buffer when content matches the declared type', () => {
    const buf = decodeAndValidateImage(PNG_B64, 'image/png');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('throws a 400 when the content does not match the declared type', () => {
    expect(() => decodeAndValidateImage(PNG_B64, 'image/jpeg')).toThrowError(/does not match/i);
    try {
      decodeAndValidateImage(PNG_B64, 'image/jpeg');
    } catch (err) {
      expect(err.status).toBe(400);
    }
  });

  it('throws for a payload that is not a recognised image', () => {
    const junk = Buffer.from('hello world').toString('base64');
    expect(() => decodeAndValidateImage(junk, 'image/png')).toThrow();
  });
});

describe('sanitizeAttachmentFilename', () => {
  it('strips directory components', () => {
    expect(sanitizeAttachmentFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeAttachmentFilename('C:\\Users\\me\\report.pdf')).toBe('report.pdf');
  });

  it('collapses whitespace padding used to hide extensions', () => {
    expect(sanitizeAttachmentFilename('Invoice.pdf      .exe')).toBe('Invoice.pdf .exe');
  });

  it('replaces control characters and illegal chars', () => {
    expect(sanitizeAttachmentFilename('a\tb\nc.txt')).toBe('a_b_c.txt');
    expect(sanitizeAttachmentFilename('a<b>c:"d".pdf')).toBe('a_b_c__d_.pdf');
  });

  it('falls back to a default for empty / dotty names', () => {
    expect(sanitizeAttachmentFilename('')).toBe('attachment');
    expect(sanitizeAttachmentFilename('..')).toBe('attachment');
    expect(sanitizeAttachmentFilename(null)).toBe('attachment');
  });

  it('caps overlong names while preserving the extension', () => {
    const long = `${'a'.repeat(500)}.pdf`;
    const out = sanitizeAttachmentFilename(long);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith('.pdf')).toBe(true);
  });
});

describe('mimeFileFilter', () => {
  const filter = mimeFileFilter(['application/pdf', 'image/png'], { label: 'attachment' });

  it('accepts a whitelisted MIME type', () => {
    const cb = vi.fn();
    filter({}, { mimetype: 'application/pdf' }, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('rejects a non-whitelisted MIME type with a 400 error', () => {
    const cb = vi.fn();
    filter({}, { mimetype: 'application/x-msdownload' }, cb);
    const [err, accepted] = cb.mock.calls[0];
    expect(accepted).toBeUndefined();
    expect(err.status).toBe(400);
    expect(err.message).toMatch(/Unsupported attachment type/);
  });
});
