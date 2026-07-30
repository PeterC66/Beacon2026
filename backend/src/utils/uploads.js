// beacon2026/backend/src/utils/uploads.js
// Shared helpers for hardening uploads: magic-byte sniffing for member photos,
// attachment-filename sanitisation, and MIME whitelists for the multer-handled
// uploads (tenant restore and email attachments). Keeping these in one place
// means the member and portal photo routes validate identically.

import { AppError } from '../middleware/errorHandler.js';

// ─── Image magic-byte sniffing ──────────────────────────────────────────────

// The photo endpoints accept only these three formats, so a small hand-rolled
// signature check is enough and avoids pulling in a third-party dependency.
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

/**
 * Sniff the real image type from the leading bytes of a buffer.
 * Returns the canonical MIME string, or null if it is not a JPEG/PNG/GIF.
 * @param {Buffer} buffer
 * @returns {'image/jpeg'|'image/png'|'image/gif'|null}
 */
export function sniffImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // GIF: "GIF87a" or "GIF89a"
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return 'image/gif';
  }

  return null;
}

/**
 * Decode a base64 photo payload and confirm its real content matches the
 * declared MIME type. Throws a 400 AppError on mismatch. Returns the decoded
 * buffer so callers can reuse it (e.g. for a size check).
 * @param {string} base64Data
 * @param {string} declaredMime
 * @returns {Buffer}
 */
export function decodeAndValidateImage(base64Data, declaredMime) {
  const buffer = Buffer.from(base64Data, 'base64');
  const sniffed = sniffImageMime(buffer);
  if (!sniffed || sniffed !== declaredMime) {
    throw AppError('Photo content does not match its declared image type.', 400);
  }
  return buffer;
}

// ─── Attachment filename sanitisation ───────────────────────────────────────

const MAX_FILENAME_LENGTH = 200;

// Control chars (0x00-0x1f, 0x7f) plus characters illegal in filenames or
// unsafe in MIME headers.
// eslint-disable-next-line no-control-regex
const UNSAFE_FILENAME_CHARS = /[\u0000-\u001f\u007f<>:"/\\|?*]/g;

/**
 * Sanitise a user-supplied attachment filename: reduce to a basename, strip
 * control characters and characters illegal in filenames / MIME headers,
 * collapse whitespace padding ("Invoice.pdf      .exe"), and cap the length.
 * @param {string} name
 * @returns {string}
 */
export function sanitizeAttachmentFilename(name) {
  const fallback = 'attachment';
  if (typeof name !== 'string' || name.length === 0) return fallback;

  // Drop any path components (both POSIX and Windows separators).
  let base = name.split(/[/\\]/).pop() || fallback;

  base = base.replace(UNSAFE_FILENAME_CHARS, '_');

  // Collapse runs of whitespace and trim the edges.
  base = base.replace(/\s+/g, ' ').trim();

  if (base.length === 0 || base === '.' || base === '..') return fallback;

  if (base.length > MAX_FILENAME_LENGTH) {
    const dot = base.lastIndexOf('.');
    const ext = dot > 0 && base.length - dot <= 10 ? base.slice(dot) : '';
    base = base.slice(0, MAX_FILENAME_LENGTH - ext.length) + ext;
  }

  return base;
}

// ─── Multer MIME whitelists ─────────────────────────────────────────────────

// Spreadsheet types accepted by the tenant restore endpoint. Some browsers
// label .xlsx uploads as octet-stream, so the filter also falls back to the
// file extension; the workbook parser rejects anything that is not real xlsx.
export const SPREADSHEET_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
];

// Common, safe attachment types for outbound email. Executables, scripts and
// other risky types are rejected before they reach SendGrid.
export const ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/zip',
];

/**
 * Build a multer fileFilter that accepts only the supplied MIME types. The
 * rejection is surfaced as a 400 AppError via the express error handler.
 * @param {string[]} allowed
 * @param {{ label?: string }} [opts]
 */
export function mimeFileFilter(allowed, { label = 'file' } = {}) {
  const set = new Set(allowed);
  return (req, file, cb) => {
    if (set.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(AppError(`Unsupported ${label} type: ${file.mimetype}`, 400));
    }
  };
}
